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

    private static final String ITEM_ID = "item_id";
    private static final String STATUS = "status";
    private static final String CREATED_AT = "created_at";
    private static final String UPDATED_AT = "updated_at";
    private static final String DELETED_AT = "deleted_at";
    private static final String NEXT_ACTIONS = "next_actions";

    private static final Map<String, Set<String>> ALLOWED_COLUMNS = Map.of(
        "items", Set.of("id", "title", STATUS, CREATED_AT, UPDATED_AT, DELETED_AT),
        "contexts", Set.of("id", "name", CREATED_AT, UPDATED_AT, DELETED_AT),
        "item_assets", Set.of("id", ITEM_ID, "file_name", "original_file_name", "content_type", "size", CREATED_AT, UPDATED_AT, DELETED_AT),
        "context_icon_assets", Set.of("id", "context_id", "file_name", "original_file_name", "content_type", "size", CREATED_AT, UPDATED_AT, DELETED_AT),
        "projects", Set.of(ITEM_ID, "deadline", STATUS, "done_date", "done_time", CREATED_AT, UPDATED_AT, DELETED_AT),
        "project_items", Set.of(ITEM_ID, "project_id"),
        NEXT_ACTIONS, Set.of(ITEM_ID, "energy", "estimated_time_minutes", "date_start", "date_end", "time_start", "time_end", "all_day", "deadline", STATUS, CREATED_AT, UPDATED_AT, DELETED_AT),
        "calendars", Set.of(ITEM_ID, "scheduled_date", "scheduled_time", "date_start", "date_end", "time_start", "time_end", "all_day", STATUS, CREATED_AT, UPDATED_AT, DELETED_AT)
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
        if (NEXT_ACTIONS.equals(change.objectType())) syncNextActionContexts(change.objectId(), payload);
    }

    private void upsert(String table, JsonNode payload) {
        List<String> columns = allowedPayloadColumns(table, payload);
        if (columns.isEmpty()) return;
        String primaryKey = OutboxTableMetadata.primaryKeyColumn(table);
        String sql = upsertSql(table, columns, primaryKey);
        jdbc.update(sql, values(payload, columns));
    }

    @SuppressWarnings("java:S2077")
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
        return columns.stream().map(column -> jdbcValue(column, payload.get(column))).toArray();
    }

    private Object jdbcValue(String column, JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isBoolean()) return node.asBoolean() ? 1 : 0;
        if (node.isIntegralNumber()) return node.asLong();
        if (node.isFloatingPointNumber()) return node.asDouble();
        String text = node.asText();
        return isTimestampColumn(column) ? normalizeTimestamp(text) : text;
    }

    private boolean isTimestampColumn(String column) {
        return CREATED_AT.equals(column) || UPDATED_AT.equals(column) || DELETED_AT.equals(column);
    }

    private String normalizeTimestamp(String raw) {
        if (isIsoUtcTimestamp(raw)) return normalizeIsoUtcTimestamp(raw);
        if (raw == null || raw.length() < 19 || raw.indexOf('.') >= 0) return raw;
        if (raw.length() == 19) return raw + ".000000";
        char separator = raw.charAt(19);
        if (separator == '+' || separator == '-' || separator == 'Z' || separator == 'z') {
            return raw.substring(0, 19) + ".000000" + raw.substring(19);
        }
        return raw;
    }

    private boolean isIsoUtcTimestamp(String raw) {
        return raw != null && raw.length() >= 20 && raw.charAt(10) == 'T' && raw.endsWith("Z");
    }

    private String normalizeIsoUtcTimestamp(String raw) {
        int fractionStart = raw.indexOf('.', 19);
        String seconds = raw.substring(0, 10) + " " + raw.substring(11, 19);
        if (fractionStart < 0) return seconds + ".000";
        String fraction = raw.substring(fractionStart + 1, raw.length() - 1);
        String milliseconds = (fraction + "000").substring(0, 3);
        return seconds + "." + milliseconds;
    }

    @SuppressWarnings("java:S2077")
    private void delete(String table, String objectId) {
        if (NEXT_ACTIONS.equals(table)) deleteNextActionContexts(objectId);
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
