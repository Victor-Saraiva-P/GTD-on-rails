package com.gtdonrails.api.sync;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.OutboxTableMetadata;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class RemoteStructuredChangeApplier {

    private static final Map<String, Set<String>> ALLOWED_COLUMNS = Map.of(
        "items", Set.of("id", "title", "status", "created_at", "updated_at", "deleted_at"),
        "contexts", Set.of("id", "name", "created_at", "updated_at", "deleted_at"),
        "item_assets", Set.of("id", "item_id", "file_name", "original_file_name", "content_type", "size", "created_at", "updated_at", "deleted_at"),
        "context_icon_assets", Set.of("id", "context_id", "file_name", "original_file_name", "content_type", "size", "created_at", "updated_at", "deleted_at"),
        "projects", Set.of("item_id", "deadline", "status", "done_date", "done_time", "created_at", "updated_at", "deleted_at"),
        "project_items", Set.of("item_id", "project_id"),
        "next_actions", Set.of("item_id", "energy", "estimated_time_minutes", "date_start", "date_end", "time_start", "time_end", "all_day", "deadline", "status", "created_at", "updated_at", "deleted_at"),
        "calendars", Set.of("item_id", "scheduled_date", "scheduled_time", "date_start", "date_end", "time_start", "time_end", "all_day", "status", "created_at", "updated_at", "deleted_at")
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public RemoteStructuredChangeApplier(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    /**
     * Applies one trusted change-feed entry without triggering Hibernate outbox listeners.
     *
     * <p>Example: {@code applier.apply(change)}.</p>
     */
    public void apply(SyncRemoteChange change) {
        requireSupportedTable(change.objectType());
        if ("DELETE".equals(change.operation())) {
            delete(change.objectType(), change.objectId());
            return;
        }
        JsonNode payload = parsePayload(change);
        upsert(change.objectType(), payload);
        if ("next_actions".equals(change.objectType())) syncNextActionContexts(change.objectId(), payload);
    }

    private void upsert(String table, JsonNode payload) {
        List<String> columns = allowedPayloadColumns(table, payload);
        if (columns.isEmpty()) return;
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);
        String sql = upsertSql(table, columns, primaryKey);
        jdbc.update(sql, values(payload, columns));
    }

    private String upsertSql(String table, List<String> columns, String primaryKey) {
        String names = String.join(", ", columns);
        String placeholders = String.join(", ", columns.stream().map(ignored -> "?").toList());
        String updates = columns.stream()
            .filter(column -> !column.equals(primaryKey))
            .map(column -> column + " = excluded." + column)
            .reduce((left, right) -> left + ", " + right)
            .orElse("");
        String suffix = updates.isBlank() ? "do nothing" : "do update set " + updates;
        return "insert into " + table + " (" + names + ") values (" + placeholders
            + ") on conflict (" + primaryKey + ") " + suffix;
    }

    private List<String> allowedPayloadColumns(String table, JsonNode payload) {
        Set<String> allowed = ALLOWED_COLUMNS.get(table);
        List<String> columns = new ArrayList<>();
        payload.fieldNames().forEachRemaining(name -> {
            if (allowed.contains(name)) columns.add(name);
        });
        return columns;
    }

    private Object[] values(JsonNode payload, List<String> columns) {
        return columns.stream().map(column -> jdbcValue(payload.get(column))).toArray();
    }

    private Object jdbcValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isBoolean()) return node.asBoolean() ? 1 : 0;
        if (node.isIntegralNumber()) return node.asLong();
        if (node.isFloatingPointNumber()) return node.asDouble();
        return node.asText();
    }

    private void delete(String table, String objectId) {
        if ("next_actions".equals(table)) deleteNextActionContexts(objectId);
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);
        jdbc.update("delete from " + table + " where " + primaryKey + " = ?", objectId);
    }

    private void syncNextActionContexts(String actionId, JsonNode payload) {
        JsonNode contextIds = payload.get("context_ids");
        if (contextIds == null || !contextIds.isArray()) return;
        deleteNextActionContexts(actionId);
        for (JsonNode contextId : contextIds) {
            jdbc.update(
                "insert or ignore into next_action_contexts (next_action_id, context_id) values (?, ?)",
                actionId,
                contextId.asText()
            );
        }
    }

    private void deleteNextActionContexts(String actionId) {
        jdbc.update("delete from next_action_contexts where next_action_id = ?", actionId);
    }

    private JsonNode parsePayload(SyncRemoteChange change) {
        try {
            return objectMapper.readTree(change.payload());
        } catch (Exception exception) {
            throw new IllegalStateException(
                "remote payload for '" + change.objectType() + ":" + change.objectId()
                    + "' is invalid; expected JSON object",
                exception
            );
        }
    }

    private void requireSupportedTable(String table) {
        if (ALLOWED_COLUMNS.containsKey(table)) return;
        throw new IllegalArgumentException(
            "remote object type '" + table + "' is invalid; expected supported GTD table"
        );
    }
}
