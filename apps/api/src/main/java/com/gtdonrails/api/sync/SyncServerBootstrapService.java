package com.gtdonrails.api.sync;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class SyncServerBootstrapService {

    private static final String ITEMS = "items";
    private static final String CONTEXTS = "contexts";
    private static final String ITEM_ID = "item_id";
    private static final String PROJECTS = "projects";
    private static final String PROJECT_ITEMS = "project_items";
    private static final String NEXT_ACTIONS = "next_actions";
    private static final String CALENDARS = "calendars";

    private static final List<String> STRUCTURED_TABLES = List.of(
        ITEMS,
        CONTEXTS,
        "item_assets",
        "context_icon_assets",
        PROJECTS,
        PROJECT_ITEMS,
        NEXT_ACTIONS,
        CALENDARS
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final SyncServerGateway gateway;
    private final LocalSyncStateStore stateStore;
    private final TransactionTemplate transactions;
    private final Path dataRoot;

    public SyncServerBootstrapService(
        JdbcTemplate jdbc,
        ObjectMapper objectMapper,
        SyncServerGateway gateway,
        LocalSyncStateStore stateStore,
        TransactionTemplate transactions,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.gateway = gateway;
        this.stateStore = stateStore;
        this.transactions = transactions;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    /**
     * Initializes this client against either an empty server or an existing canonical dataset.
     *
     * <p>Example: {@code bootstrap.initializeIfNeeded()}.</p>
     */
    public void initializeIfNeeded() {
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        if (hasEpoch(local.datasetEpoch())) return;

        SyncServerGateway.SyncRemoteState remote = gateway.state();
        transactions.executeWithoutResult(status -> initializeLocalState(remote));
    }

    private void initializeLocalState(SyncServerGateway.SyncRemoteState remote) {
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        if (hasEpoch(local.datasetEpoch())) return;

        stateStore.updateClientState(remote.datasetEpoch(), 0);
        if (remote.cursor() > 0) return;
        supersedeLegacyPendingEvents();
        STRUCTURED_TABLES.forEach(this::enqueueTable);
        enqueueFiles();
    }

    private void supersedeLegacyPendingEvents() {
        jdbc.update(
            """
            update sync_outbox
            set status = 'COMPLETED', last_error = 'superseded by SQLite sync-server bootstrap'
            where status in ('PENDING', 'PROCESSING')
            """
        );
    }

    private void enqueueTable(String table) {
        for (Map<String, Object> row : jdbc.queryForList(selectAllSql(table))) {
            Map<String, Object> payload = normalizedRow(table, row);
            enqueueStructured(table, objectId(table, payload), payload);
        }
    }

    private String selectAllSql(String table) {
        return switch (table) {
            case ITEMS -> "select * from items";
            case CONTEXTS -> "select * from contexts";
            case "item_assets" -> "select * from item_assets";
            case "context_icon_assets" -> "select * from context_icon_assets";
            case PROJECTS -> "select * from projects";
            case PROJECT_ITEMS -> "select * from project_items";
            case NEXT_ACTIONS -> "select * from next_actions";
            case CALENDARS -> "select * from calendars";
            default -> throw new IllegalArgumentException("unsupported bootstrap table '" + table + "'");
        };
    }

    private Map<String, Object> normalizedRow(String table, Map<String, Object> row) {
        Map<String, Object> payload = new LinkedHashMap<>(row);
        if (ITEMS.equals(table)) payload.remove("body");
        if (NEXT_ACTIONS.equals(table)) addContextIds(payload);
        return payload;
    }

    private void addContextIds(Map<String, Object> payload) {
        String itemId = String.valueOf(payload.get(ITEM_ID));
        List<String> contextIds = jdbc.queryForList(
            "select context_id from next_action_contexts where next_action_id = ? order by context_id",
            String.class,
            itemId
        );
        payload.put("context_ids", contextIds);
    }

    private void enqueueStructured(String table, String objectId, Map<String, Object> payload) {
        jdbc.update(
            """
            insert into sync_outbox
                (operation_id, entity_type, entity_id, operation, payload, status, retry_count)
            values (?, ?, ?, 'INSERT', ?, 'PENDING', 0)
            """,
            UUID.randomUUID().toString(),
            table,
            objectId,
            toJson(payload)
        );
    }

    private String objectId(String table, Map<String, Object> row) {
        String key = "id";
        if (SetOfItemIdTables.contains(table)) key = ITEM_ID;
        Object value = row.get(key);
        if (value == null) {
            throw new IllegalStateException(
                "bootstrap row for table '" + table + "' lacks key '" + key + "'; expected canonical object ID"
            );
        }
        return value.toString();
    }

    private void enqueueFiles() {
        enqueueBodyDocuments();
        enqueueItemAssets();
        enqueueContextIcons();
    }

    private void enqueueBodyDocuments() {
        for (String itemId : jdbc.queryForList("select id from items", String.class)) {
            String path = Path.of(ITEMS, itemId, "body.md").toString();
            enqueueFileIfPresent("body_document", itemId, path, "text/markdown");
        }
    }

    private void enqueueItemAssets() {
        String sql = "select id, item_id, file_name, content_type from item_assets";
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            String id = String.valueOf(row.get("id"));
            String path = Path.of(
                "items",
                String.valueOf(row.get(ITEM_ID)),
                "assets",
                id,
                String.valueOf(row.get("file_name"))
            ).toString();
            enqueueFileIfPresent("item_asset_file", id, path, String.valueOf(row.get("content_type")));
        }
    }

    private void enqueueContextIcons() {
        String sql = "select id, context_id, file_name, content_type from context_icon_assets";
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            String id = String.valueOf(row.get("id"));
            String path = Path.of(
                "assets",
                "contexts",
                String.valueOf(row.get("context_id")),
                id,
                String.valueOf(row.get("file_name"))
            ).toString();
            enqueueFileIfPresent("context_icon_file", id, path, String.valueOf(row.get("content_type")));
        }
    }

    private void enqueueFileIfPresent(
        String objectType,
        String objectId,
        String relativePath,
        String contentType
    ) {
        if (!Files.isRegularFile(dataRoot.resolve(relativePath))) return;
        jdbc.update(
            """
            insert into sync_file_outbox
                (operation_id, object_type, object_id, operation, relative_path, content_type, status, retry_count)
            values (?, ?, ?, 'UPSERT', ?, ?, 'PENDING', 0)
            """,
            UUID.randomUUID().toString(),
            objectType,
            objectId,
            relativePath,
            contentType
        );
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize SQLite bootstrap row as JSON", exception);
        }
    }

    private boolean hasEpoch(String value) {
        return value != null && !value.isBlank();
    }

    private static final class SetOfItemIdTables {
        private static final java.util.Set<String> VALUES = java.util.Set.of(
            PROJECTS, PROJECT_ITEMS, NEXT_ACTIONS, CALENDARS
        );

        static boolean contains(String table) {
            return VALUES.contains(table);
        }
    }
}
