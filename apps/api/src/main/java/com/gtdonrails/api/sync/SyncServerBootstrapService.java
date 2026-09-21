package com.gtdonrails.api.sync;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncServerBootstrapService {

    private static final List<String> STRUCTURED_TABLES = List.of(
        "items",
        "contexts",
        "item_assets",
        "context_icon_assets",
        "projects",
        "project_items",
        "next_actions",
        "calendars"
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final SyncServerGateway gateway;
    private final LocalSyncStateStore stateStore;
    private final Path dataRoot;

    public SyncServerBootstrapService(
        JdbcTemplate jdbc,
        ObjectMapper objectMapper,
        SyncServerGateway gateway,
        LocalSyncStateStore stateStore,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.gateway = gateway;
        this.stateStore = stateStore;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    /**
     * Initializes this client against either an empty server or an existing canonical dataset.
     *
     * <p>Example: {@code bootstrap.initializeIfNeeded()}.</p>
     */
    @Transactional
    public void initializeIfNeeded() {
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        if (hasEpoch(local.datasetEpoch())) return;
        SyncServerGateway.SyncRemoteState remote = gateway.state();
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
        for (Map<String, Object> row : jdbc.queryForList("select * from " + table)) {
            Map<String, Object> payload = normalizedRow(table, row);
            enqueueStructured(table, objectId(table, payload), payload);
        }
    }

    private Map<String, Object> normalizedRow(String table, Map<String, Object> row) {
        Map<String, Object> payload = new LinkedHashMap<>(row);
        if ("items".equals(table)) payload.remove("body");
        if ("next_actions".equals(table)) addContextIds(payload);
        return payload;
    }

    private void addContextIds(Map<String, Object> payload) {
        String itemId = String.valueOf(payload.get("item_id"));
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
        if (SetOfItemIdTables.contains(table)) key = "item_id";
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
            enqueueFileIfPresent("body_document", itemId, "items/" + itemId + "/body.md", "text/markdown");
        }
    }

    private void enqueueItemAssets() {
        String sql = "select id, item_id, file_name, content_type from item_assets";
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            String id = String.valueOf(row.get("id"));
            String path = "items/" + row.get("item_id") + "/assets/" + id + "/" + row.get("file_name");
            enqueueFileIfPresent("item_asset_file", id, path, String.valueOf(row.get("content_type")));
        }
    }

    private void enqueueContextIcons() {
        String sql = "select id, context_id, file_name, content_type from context_icon_assets";
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            String id = String.valueOf(row.get("id"));
            String path = "assets/contexts/" + row.get("context_id") + "/" + id + "/" + row.get("file_name");
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
            "projects", "project_items", "next_actions", "calendars"
        );

        static boolean contains(String table) {
            return VALUES.contains(table);
        }
    }
}
