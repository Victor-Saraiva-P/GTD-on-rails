package com.gtdonrails.syncserver;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

@Component
public class GoogleCalendarMirrorStore {

    private final SyncObjectStore objectStore;

    public GoogleCalendarMirrorStore(SyncObjectStore objectStore) {
        this.objectStore = objectStore;
        initializeSchema();
    }

    public void enqueueRefresh(String objectId) {
        String sql = """
            INSERT INTO google_calendar_outbox
                (object_id, status, retry_count, last_error, updated_at)
            VALUES (?, 'PENDING', 0, NULL, ?)
            ON CONFLICT(object_id) DO UPDATE SET
                status = 'PENDING', last_error = NULL, updated_at = excluded.updated_at
            """;
        update(sql, objectId, Instant.now().toString());
    }

    public List<PendingProjection> pending(int limit) {
        String sql = """
            SELECT object_id, retry_count
            FROM google_calendar_outbox
            WHERE status = 'PENDING'
            ORDER BY updated_at ASC
            LIMIT ?
            """;
        return queryPending(sql, limit);
    }

    public void markCompleted(String objectId) {
        update("DELETE FROM google_calendar_outbox WHERE object_id = ?", objectId);
    }

    public void markFailed(String objectId, String error) {
        String sql = """
            UPDATE google_calendar_outbox
            SET status = 'PENDING', retry_count = retry_count + 1,
                last_error = ?, updated_at = ?
            WHERE object_id = ?
            """;
        update(sql, error, Instant.now().toString(), objectId);
    }

    public long pendingCount() {
        return queryLong("SELECT count(*) FROM google_calendar_outbox WHERE status = 'PENDING'");
    }

    public Optional<String> lastError() {
        String sql = """
            SELECT last_error FROM google_calendar_outbox
            WHERE last_error IS NOT NULL
            ORDER BY updated_at DESC LIMIT 1
            """;
        return queryString(sql);
    }

    public void saveCalendar(String name, String googleCalendarId, String colorHex) {
        String sql = """
            INSERT INTO google_calendar_mirrors (name, google_calendar_id, color_hex)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                google_calendar_id = excluded.google_calendar_id,
                color_hex = excluded.color_hex
            """;
        update(sql, name, googleCalendarId, colorHex);
    }

    public Optional<CalendarMirror> calendar(String name) {
        String sql = """
            SELECT name, google_calendar_id, color_hex
            FROM google_calendar_mirrors WHERE name = ?
            """;
        return queryCalendar(sql, name);
    }

    public List<CalendarMirror> calendars() {
        String sql = """
            SELECT name, google_calendar_id, color_hex
            FROM google_calendar_mirrors ORDER BY name
            """;
        return queryCalendars(sql);
    }

    public boolean hasAllCalendars() {
        return calendars().size() == 5;
    }

    private List<PendingProjection> queryPending(String sql, int limit) {
        try (Connection connection = open();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, Math.max(1, limit));
            return readPending(statement);
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private List<PendingProjection> readPending(PreparedStatement statement) throws SQLException {
        List<PendingProjection> pending = new ArrayList<>();
        try (ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                pending.add(new PendingProjection(result.getString(1), result.getInt(2)));
            }
        }
        return pending;
    }

    private Optional<CalendarMirror> queryCalendar(String sql, String name) {
        try (Connection connection = open();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Optional.of(readCalendar(result)) : Optional.empty();
            }
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private List<CalendarMirror> queryCalendars(String sql) {
        try (Connection connection = open();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet result = statement.executeQuery()) {
            List<CalendarMirror> calendars = new ArrayList<>();
            while (result.next()) calendars.add(readCalendar(result));
            return calendars;
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private CalendarMirror readCalendar(ResultSet result) throws SQLException {
        return new CalendarMirror(result.getString(1), result.getString(2), result.getString(3));
    }

    private long queryLong(String sql) {
        try (Connection connection = open();
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            return result.next() ? result.getLong(1) : 0L;
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private Optional<String> queryString(String sql) {
        try (Connection connection = open();
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            return result.next() ? Optional.ofNullable(result.getString(1)) : Optional.empty();
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private void update(String sql, Object... values) {
        try (Connection connection = open();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            statement.executeUpdate();
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private void bind(PreparedStatement statement, Object[] values) throws SQLException {
        for (int index = 0; index < values.length; index += 1) {
            statement.setObject(index + 1, values[index]);
        }
    }

    private void initializeSchema() {
        try (Connection connection = open();
             Statement statement = connection.createStatement()) {
            statement.execute(outboxSql());
            statement.execute(calendarSql());
        } catch (SQLException exception) {
            throw failure(exception);
        }
    }

    private String outboxSql() {
        return """
            CREATE TABLE IF NOT EXISTS google_calendar_outbox (
                object_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                updated_at TEXT NOT NULL
            )
            """;
    }

    private String calendarSql() {
        return """
            CREATE TABLE IF NOT EXISTS google_calendar_mirrors (
                name TEXT PRIMARY KEY,
                google_calendar_id TEXT NOT NULL,
                color_hex TEXT NOT NULL
            )
            """;
    }

    private Connection open() throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + objectStore.databasePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA busy_timeout = 30000");
            statement.execute("PRAGMA journal_mode = WAL");
        }
        return connection;
    }

    private IllegalStateException failure(SQLException exception) {
        return new IllegalStateException("Google Calendar mirror persistence failed", exception);
    }

    public record PendingProjection(String objectId, int retryCount) {
    }

    public record CalendarMirror(String name, String googleCalendarId, String colorHex) {
    }
}
