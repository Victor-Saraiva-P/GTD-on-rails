package com.gtdonrails.api.maintenance.cutover;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public final class LegacySqliteTestFixture {

    private LegacySqliteTestFixture() {}

    /**
     * Initializes a SQLite database file with the final legacy GTD schema.
     *
     * <p>Example: {@code LegacySqliteTestFixture.initSchema(sqlitePath)}.</p>
     */
    public static void initSchema(Path sqlitePath) {
        String url = "jdbc:sqlite:" + sqlitePath.toAbsolutePath().normalize();
        try (Connection connection = DriverManager.getConnection(url);
             Statement statement = connection.createStatement()) {
            createSchemaTables(statement);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to initialize legacy SQLite schema on " + sqlitePath, exception);
        }
    }

    private static void createSchemaTables(Statement statement) throws SQLException {
        String[] statements = new String[] {
            "CREATE TABLE IF NOT EXISTS items (id text PRIMARY KEY, title text NOT NULL, body text NOT NULL DEFAULT '{\"text\":\"\",\"inlineMarks\":[],\"lineBlocks\":[],\"blockEntities\":[]}', status text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS contexts (id text PRIMARY KEY, name text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS item_assets (id text PRIMARY KEY, item_id text NOT NULL REFERENCES items(id), file_name text NOT NULL, original_file_name text NOT NULL, content_type text NOT NULL, size integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS context_icon_assets (id text PRIMARY KEY, context_id text NOT NULL REFERENCES contexts(id), file_name text NOT NULL, original_file_name text NOT NULL, content_type text NOT NULL, size integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS next_actions (item_id text PRIMARY KEY REFERENCES items(id), energy real NOT NULL, estimated_time_minutes integer NOT NULL, date_start text, date_end text, time_start text, time_end text, all_day integer NOT NULL DEFAULT 0, deadline text, status text NOT NULL DEFAULT 'NEXT_ACTION', created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS next_action_contexts (next_action_id text NOT NULL REFERENCES next_actions(item_id), context_id text NOT NULL REFERENCES contexts(id), PRIMARY KEY (next_action_id, context_id))",
            "CREATE TABLE IF NOT EXISTS calendars (item_id text PRIMARY KEY REFERENCES items(id), scheduled_date text NOT NULL, scheduled_time text, date_start text, date_end text, time_start text, time_end text, all_day integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'CALENDAR', created_at text NOT NULL, updated_at text NOT NULL, deleted_at text)",
            "CREATE TABLE IF NOT EXISTS maintenance_runs (name text PRIMARY KEY, last_run_at text NOT NULL)",
            "CREATE TABLE IF NOT EXISTS google_credentials (id text PRIMARY KEY, access_token text NOT NULL, refresh_token text NOT NULL, token_type text NOT NULL, expires_at text NOT NULL, scope text NOT NULL)",
            "CREATE TABLE IF NOT EXISTS google_calendars (id text PRIMARY KEY, google_calendar_id text NOT NULL, name text NOT NULL, color_hex text NOT NULL)"
        };
        for (String sql : statements) {
            statement.execute(sql);
        }
    }
}
