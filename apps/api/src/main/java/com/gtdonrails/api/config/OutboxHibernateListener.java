package com.gtdonrails.api.config;

import java.util.Set;

import com.gtdonrails.api.entities.SyncOutboxOperation;
import com.gtdonrails.api.services.DatabaseSyncService;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Listens to Hibernate entity lifecycle events and writes outbox entries for sync.
 *
 * <p>Example: Automatically invoked by Hibernate after INSERT, UPDATE, DELETE.</p>
 */
@Component
public class OutboxHibernateListener implements PostInsertEventListener, PostUpdateEventListener, PostDeleteEventListener {

    private static final Logger logger = LoggerFactory.getLogger(OutboxHibernateListener.class);

    // WHY: The outbox table itself must not trigger further outbox events,
    // and local infrastructure/secret entities (tokens, cutover state, maintenance)
    // are local device state that should not be replicated via database sync.
    private static final Set<String> EXCLUDED_ENTITIES = Set.of(
        "SyncOutboxEvent", "MaintenanceRun", "GoogleCredential", "GoogleCalendar"
    );

    private final JdbcTemplate jdbcTemplate;
    private final DatabaseSyncService databaseSyncService;
    private final OutboxPayloadSerializer payloadSerializer;

    /**
     * Creates an outbox listener with the provided dependencies.
     *
     * @example new OutboxHibernateListener(jdbcTemplate, databaseSyncService)
     */
    public OutboxHibernateListener(
        JdbcTemplate jdbcTemplate,
        @Lazy DatabaseSyncService databaseSyncService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.databaseSyncService = databaseSyncService;
        this.payloadSerializer = new OutboxPayloadSerializer();
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        captureEvent(event.getEntity(), event.getPersister(), SyncOutboxOperation.INSERT);
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        captureEvent(event.getEntity(), event.getPersister(), SyncOutboxOperation.UPDATE);
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        captureEvent(event.getEntity(), event.getPersister(), SyncOutboxOperation.DELETE);
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private void captureEvent(Object entity, EntityPersister persister, SyncOutboxOperation operation) {
        String entityName = entity.getClass().getSimpleName();
        if (EXCLUDED_ENTITIES.contains(entityName)) return;

        String tableName = extractTableName(persister);
        String entityId = extractEntityId(entity);
        String payload = operation == SyncOutboxOperation.DELETE
            ? payloadSerializer.serializeDeletePayload(tableName, entityId)
            : payloadSerializer.serializeEntity(entity);

        if (payload == null) return;
        persistOutboxRecord(tableName, entityId, operation, payload);
    }

    private void persistOutboxRecord(String tableName, String entityId, SyncOutboxOperation operation, String payload) {
        jdbcTemplate.update(
            "insert into sync_outbox (entity_type, entity_id, operation, payload, status, retry_count) values (?, ?, ?, ?, 'PENDING', 0)",
            tableName, entityId, operation.name(), payload
        );
        databaseSyncService.notifyNewEvents();
        logOutboxCapture(tableName, entityId, operation);
    }

    private void logOutboxCapture(String tableName, String entityId, SyncOutboxOperation operation) {
        logger.atDebug()
            .addKeyValue("event", "outbox_event_captured")
            .addKeyValue("table", tableName)
            .addKeyValue("entityId", entityId)
            .addKeyValue("operation", operation.name())
            .log("Captured outbox event");
    }

    private String extractTableName(EntityPersister persister) {
        String fullName = persister.getRootTableName();
        int dotIndex = fullName.lastIndexOf('.');
        return dotIndex >= 0 ? fullName.substring(dotIndex + 1) : fullName;
    }

    private String extractEntityId(Object entity) {
        try {
            var idMethod = findIdGetter(entity);
            Object id = idMethod.invoke(entity);
            return id != null ? id.toString() : "";
        } catch (Exception exception) {
            throw new IllegalStateException(
                "entity class '%s' has no accessible id getter; expected getId() or getItemId()"
                    .formatted(entity.getClass().getName()),
                exception
            );
        }
    }

    private java.lang.reflect.Method findIdGetter(Object entity) throws NoSuchMethodException {
        try {
            return entity.getClass().getMethod("getId");
        } catch (NoSuchMethodException ignored) {
            return entity.getClass().getMethod("getItemId");
        }
    }
}
