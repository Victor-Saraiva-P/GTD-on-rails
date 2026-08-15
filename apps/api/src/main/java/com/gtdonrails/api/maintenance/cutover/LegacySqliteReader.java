package com.gtdonrails.api.maintenance.cutover;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

@Component
public class LegacySqliteReader {

    @FunctionalInterface
    private interface SqliteRowMapper<T> {
        T mapRow(ResultSet rs) throws SQLException;
    }

    /**
     * Reads all legacy GTD records from the given SQLite database path.
     *
     * <p>Example: {@code reader.readDataset(Path.of("gtd-on-rails.db"))}.</p>
     */
    public LegacySqliteDataset readDataset(Path sqlitePath) {
        requireReadableFile(sqlitePath);
        String url = "jdbc:sqlite:" + sqlitePath.toAbsolutePath().normalize();
        try (Connection connection = DriverManager.getConnection(url)) {
            return readFromConnection(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException(
                "SQLite database at '%s' is invalid; expected readable GTD database".formatted(sqlitePath), exception);
        }
    }

    private void requireReadableFile(Path path) {
        if (path == null || !Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException(
                "SQLite path value '%s' is invalid; expected readable regular file".formatted(path));
        }
    }

    LegacySqliteDataset readFromConnection(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            return new LegacySqliteDataset(
                readItems(statement),
                readContexts(statement),
                readItemAssets(statement),
                readContextIconAssets(statement),
                readNextActions(statement),
                readNextActionContexts(statement),
                readCalendars(statement),
                readMaintenanceRuns(statement),
                readGoogleCredentials(statement),
                readGoogleCalendars(statement)
            );
        }
    }

    private List<LegacyItemRecord> readItems(Statement statement) throws SQLException {
        String sql = "SELECT id, title, body, status, created_at, updated_at, deleted_at FROM items";
        return queryTable(statement, "items", sql, rs -> new LegacyItemRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            rs.getString("title"),
            rs.getString("body"),
            rs.getString("status"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyContextRecord> readContexts(Statement statement) throws SQLException {
        String sql = "SELECT id, name, created_at, updated_at, deleted_at FROM contexts";
        return queryTable(statement, "contexts", sql, rs -> new LegacyContextRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            rs.getString("name"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyItemAssetRecord> readItemAssets(Statement statement) throws SQLException {
        String sql = "SELECT id, item_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at FROM item_assets";
        return queryTable(statement, "item_assets", sql, rs -> new LegacyItemAssetRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            LegacySqliteValueParser.readUuid(rs, "item_id"),
            rs.getString("file_name"),
            rs.getString("original_file_name"),
            rs.getString("content_type"),
            rs.getLong("size"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyContextIconAssetRecord> readContextIconAssets(Statement statement) throws SQLException {
        String sql = "SELECT id, context_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at FROM context_icon_assets";
        return queryTable(statement, "context_icon_assets", sql, rs -> new LegacyContextIconAssetRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            LegacySqliteValueParser.readUuid(rs, "context_id"),
            rs.getString("file_name"),
            rs.getString("original_file_name"),
            rs.getString("content_type"),
            rs.getLong("size"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyNextActionRecord> readNextActions(Statement statement) throws SQLException {
        String sql = "SELECT item_id, energy, estimated_time_minutes, date_start, date_end, time_start, time_end, all_day, deadline, status, created_at, updated_at, deleted_at FROM next_actions";
        return queryTable(statement, "next_actions", sql, rs -> new LegacyNextActionRecord(
            LegacySqliteValueParser.readUuid(rs, "item_id"),
            LegacySqliteValueParser.readBigDecimal(rs, "energy"),
            rs.getLong("estimated_time_minutes"),
            LegacySqliteValueParser.readLocalDate(rs, "date_start"),
            LegacySqliteValueParser.readLocalDate(rs, "date_end"),
            LegacySqliteValueParser.readLocalTime(rs, "time_start"),
            LegacySqliteValueParser.readLocalTime(rs, "time_end"),
            rs.getBoolean("all_day"),
            LegacySqliteValueParser.readLocalDate(rs, "deadline"),
            rs.getString("status"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyNextActionContextRecord> readNextActionContexts(Statement statement) throws SQLException {
        String sql = "SELECT next_action_id, context_id FROM next_action_contexts";
        return queryTable(statement, "next_action_contexts", sql, rs -> new LegacyNextActionContextRecord(
            LegacySqliteValueParser.readUuid(rs, "next_action_id"),
            LegacySqliteValueParser.readUuid(rs, "context_id")));
    }

    private List<LegacyCalendarRecord> readCalendars(Statement statement) throws SQLException {
        String sql = "SELECT item_id, scheduled_date, scheduled_time, date_start, date_end, time_start, time_end, all_day, status, created_at, updated_at, deleted_at FROM calendars";
        return queryTable(statement, "calendars", sql, rs -> new LegacyCalendarRecord(
            LegacySqliteValueParser.readUuid(rs, "item_id"),
            LegacySqliteValueParser.readLocalDate(rs, "scheduled_date"),
            LegacySqliteValueParser.readLocalTime(rs, "scheduled_time"),
            LegacySqliteValueParser.readLocalDate(rs, "date_start"),
            LegacySqliteValueParser.readLocalDate(rs, "date_end"),
            LegacySqliteValueParser.readLocalTime(rs, "time_start"),
            LegacySqliteValueParser.readLocalTime(rs, "time_end"),
            rs.getBoolean("all_day"),
            rs.getString("status"),
            LegacySqliteValueParser.readInstant(rs, "created_at"),
            LegacySqliteValueParser.readInstant(rs, "updated_at"),
            LegacySqliteValueParser.readInstant(rs, "deleted_at")));
    }

    private List<LegacyMaintenanceRunRecord> readMaintenanceRuns(Statement statement) throws SQLException {
        String sql = "SELECT name, last_run_at FROM maintenance_runs";
        return queryTable(statement, "maintenance_runs", sql, rs -> new LegacyMaintenanceRunRecord(
            rs.getString("name"),
            LegacySqliteValueParser.readInstant(rs, "last_run_at")));
    }

    private List<LegacyGoogleCredentialRecord> readGoogleCredentials(Statement statement) throws SQLException {
        String sql = "SELECT id, access_token, refresh_token, token_type, expires_at, scope FROM google_credentials";
        return queryTable(statement, "google_credentials", sql, rs -> new LegacyGoogleCredentialRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            rs.getString("access_token"),
            rs.getString("refresh_token"),
            rs.getString("token_type"),
            LegacySqliteValueParser.readInstant(rs, "expires_at"),
            rs.getString("scope")));
    }

    private List<LegacyGoogleCalendarRecord> readGoogleCalendars(Statement statement) throws SQLException {
        String sql = "SELECT id, google_calendar_id, name, color_hex FROM google_calendars";
        return queryTable(statement, "google_calendars", sql, rs -> new LegacyGoogleCalendarRecord(
            LegacySqliteValueParser.readUuid(rs, "id"),
            rs.getString("google_calendar_id"),
            rs.getString("name"),
            rs.getString("color_hex")));
    }

    private <T> List<T> queryTable(Statement statement, String table, String sql, SqliteRowMapper<T> mapper) throws SQLException {
        if (!tableExists(statement, table)) return List.of();
        List<T> results = new ArrayList<>();
        try (ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) results.add(mapper.mapRow(rs));
        }
        return results;
    }

    private boolean tableExists(Statement statement, String tableName) throws SQLException {
        try (ResultSet rs = statement.executeQuery("SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '" + tableName + "'")) {
            return rs.next() && rs.getInt(1) > 0;
        }
    }
}
