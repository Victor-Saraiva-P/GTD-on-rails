package com.gtdonrails.api.services;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.OutboxTableMetadata;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Pushes local outbox events to the remote Supabase PostgreSQL database.
 *
 * <p>Example: {@code pushSyncService.pushEvent(event)}.</p>
 */
@Service
@ConditionalOnProperty(name = "gtd.sync.database.enabled", havingValue = "true")
public class SupabasePushSyncService {

    private static final Logger logger = LoggerFactory.getLogger(SupabasePushSyncService.class);

    private final JdbcTemplate supabaseJdbc;
    private final ObjectMapper objectMapper;

    /**
     * Creates a Supabase push service with the given JDBC template and default ObjectMapper.
     *
     * @example new SupabasePushSyncService(supabaseJdbc)
     */
    @org.springframework.beans.factory.annotation.Autowired
    public SupabasePushSyncService(
        @Qualifier("supabaseJdbcTemplate") JdbcTemplate supabaseJdbc
    ) {
        this(supabaseJdbc, new ObjectMapper());
    }

    /**
     * Creates a Supabase push service with the given JDBC template and ObjectMapper.
     *
     * @example new SupabasePushSyncService(supabaseJdbc, objectMapper)
     */
    public SupabasePushSyncService(
        @Qualifier("supabaseJdbcTemplate") JdbcTemplate supabaseJdbc,
        ObjectMapper objectMapper
    ) {
        this.supabaseJdbc = supabaseJdbc;
        this.objectMapper = objectMapper;
    }

    /**
     * Pushes a single outbox event to the remote Supabase PostgreSQL database.
     *
     * @example pushSyncService.pushEvent(outboxEvent)
     */
    public void pushEvent(SyncOutboxEvent event) {
        SyncOutboxOperation operation = event.getOperation();

        switch (operation) {
            case INSERT -> pushInsert(event);
            case UPDATE -> pushUpdate(event);
            case DELETE -> pushDelete(event);
        }

        logPushCompleted(event, operation);
    }

    private void logPushCompleted(SyncOutboxEvent event, SyncOutboxOperation operation) {
        logger.atInfo()
            .addKeyValue("event", "supabase_push_completed")
            .addKeyValue("entityType", event.getEntityType())
            .addKeyValue("entityId", event.getEntityId())
            .addKeyValue("operation", operation.name())
            .log("Pushed outbox event to Supabase");
    }

    private void pushInsert(SyncOutboxEvent event) {
        JsonNode payload = parsePayload(event);
        String table = event.getEntityType();
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);
        String columns = buildColumnList(payload);
        String placeholders = buildPlaceholderList(payload);
        String updateSet = buildUpsertSetClause(payload, primaryKey);
        Object[] values = extractValues(payload);

        String sql = updateSet.isBlank()
            ? "INSERT INTO gtd.%s (%s) VALUES (%s) ON CONFLICT (%s) DO NOTHING"
                .formatted(table, columns, placeholders, primaryKey)
            : "INSERT INTO gtd.%s (%s) VALUES (%s) ON CONFLICT (%s) DO UPDATE SET %s"
                .formatted(table, columns, placeholders, primaryKey, updateSet);

        supabaseJdbc.update(sql, values);
        if ("next_actions".equals(table)) {
            syncNextActionContexts(event.getEntityId(), payload.get("context_ids"));
        }
    }

    private void pushUpdate(SyncOutboxEvent event) {
        JsonNode payload = parsePayload(event);
        String table = event.getEntityType();
        String entityId = event.getEntityId();
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);
        String setClause = buildSetClause(payload, primaryKey, event);
        Object[] values = extractUpdateValues(payload, primaryKey, entityId);

        String sql = "UPDATE gtd.%s SET %s WHERE %s = ?"
            .formatted(table, setClause, primaryKey);

        supabaseJdbc.update(sql, values);
        if ("next_actions".equals(table)) {
            syncNextActionContexts(entityId, payload.get("context_ids"));
        }
    }

    private static final java.util.regex.Pattern UUID_PATTERN =
        java.util.regex.Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final java.util.regex.Pattern INSTANT_PATTERN =
        java.util.regex.Pattern.compile("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?$");
    private static final java.util.regex.Pattern DATE_PATTERN =
        java.util.regex.Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final java.util.regex.Pattern TIME_PATTERN =
        java.util.regex.Pattern.compile("^\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?$");

    private void pushDelete(SyncOutboxEvent event) {
        String table = event.getEntityType();
        String entityId = event.getEntityId();
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);

        if ("next_actions".equals(table)) {
            deleteNextActionContexts(entityId);
        }

        String sql = "DELETE FROM gtd.%s WHERE %s = ?".formatted(table, primaryKey);
        supabaseJdbc.update(sql, parseTypedString(entityId));
    }

    private void syncNextActionContexts(String nextActionId, JsonNode contextIdsNode) {
        if (contextIdsNode == null || !contextIdsNode.isArray()) return;
        deleteNextActionContexts(nextActionId);
        String sql = "INSERT INTO gtd.next_action_contexts (next_action_id, context_id) VALUES (?, ?) ON CONFLICT (next_action_id, context_id) DO NOTHING";
        for (JsonNode idNode : contextIdsNode) {
            supabaseJdbc.update(sql, parseTypedString(nextActionId), parseTypedString(idNode.asText()));
        }
    }

    private void deleteNextActionContexts(String nextActionId) {
        supabaseJdbc.update(
            "DELETE FROM gtd.next_action_contexts WHERE next_action_id = ?",
            parseTypedString(nextActionId)
        );
    }

    private JsonNode parsePayload(SyncOutboxEvent event) {
        try {
            return objectMapper.readTree(event.getPayload());
        } catch (Exception exception) {
            throw new IllegalStateException(
                "outbox payload for entity '%s:%s' is invalid; expected valid JSON: %s"
                    .formatted(event.getEntityType(), event.getEntityId(), event.getPayload()),
                exception
            );
        }
    }

    private String buildColumnList(JsonNode payload) {
        return String.join(", ", iterableFieldNames(payload));
    }

    private String buildPlaceholderList(JsonNode payload) {
        return String.join(", ", iterableFieldNames(payload).stream()
            .map(name -> "?")
            .toList());
    }

    private String buildUpsertSetClause(JsonNode payload, String primaryKey) {
        return iterableFieldNames(payload).stream()
            .filter(name -> !name.equals(primaryKey))
            .map(name -> "%s = EXCLUDED.%s".formatted(name, name))
            .reduce((a, b) -> a + ", " + b)
            .orElse("");
    }

    private Object[] extractValues(JsonNode payload) {
        return iterableFieldNames(payload).stream()
            .map(name -> nodeToJdbcValue(payload.get(name)))
            .toArray();
    }

    private String buildSetClause(JsonNode payload, String primaryKey, SyncOutboxEvent event) {
        return iterableFieldNames(payload).stream()
            .filter(name -> !name.equals(primaryKey))
            .map(name -> name + " = ?")
            .reduce((a, b) -> a + ", " + b)
            .orElseThrow(() -> new IllegalStateException(
                "outbox payload for entity '%s:%s' has no updatable columns; expected at least one non-PK field in %s"
                    .formatted(event.getEntityType(), event.getEntityId(), event.getPayload())));
    }

    private Object[] extractUpdateValues(JsonNode payload, String primaryKey, String entityId) {
        List<Object> values = new ArrayList<>();
        for (String name : iterableFieldNames(payload)) {
            if (!name.equals(primaryKey)) {
                values.add(nodeToJdbcValue(payload.get(name)));
            }
        }
        values.add(parseTypedString(entityId));
        return values.toArray();
    }

    private List<String> iterableFieldNames(JsonNode payload) {
        List<String> names = new ArrayList<>();
        payload.fieldNames().forEachRemaining(name -> {
            if (!"context_ids".equals(name)) {
                names.add(name);
            }
        });
        return names;
    }

    private Object parseTypedString(String text) {
        if (text.length() == 36 && UUID_PATTERN.matcher(text).matches()) {
            return java.util.UUID.fromString(text);
        }
        if (INSTANT_PATTERN.matcher(text).matches()) {
            return java.time.OffsetDateTime.parse(text);
        }
        if (DATE_PATTERN.matcher(text).matches()) {
            return java.time.LocalDate.parse(text);
        }
        if (TIME_PATTERN.matcher(text).matches()) {
            return java.time.LocalTime.parse(text);
        }
        return text;
    }

    private Object nodeToJdbcValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isBoolean()) return node.asBoolean();
        if (node.isInt() || node.isLong()) return node.asLong();
        if (node.isDouble() || node.isFloat()) return node.asDouble();
        return parseTypedString(node.asText());
    }
}
