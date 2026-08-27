package com.gtdonrails.api.entities;

/**
 * Provides database schema metadata and primary key mapping for outbox synchronization.
 *
 * <p>Example: {@code OutboxTableMetadata.primaryKeyColumn("items")}.</p>
 */
public final class OutboxTableMetadata {

    private OutboxTableMetadata() {
        // WHY: Utility class with static schema helpers.
    }

    /**
     * Resolves the primary key column name for a given table name.
     *
     * @example OutboxTableMetadata.primaryKeyColumn("next_actions")
     */
    public static String primaryKeyColumn(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException(
                "table name value '%s' is invalid; expected non-blank table name".formatted(tableName)
            );
        }

        return switch (tableName) {
            case "next_actions", "calendars", "projects", "project_items" -> "item_id";
            case "maintenance_runs" -> "name";
            default -> "id";
        };
    }
}
