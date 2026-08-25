package com.gtdonrails.api.maintenance.cutover;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import com.gtdonrails.api.persistence.converters.CryptoConverter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LegacyDatasetImporter {

    private final JdbcTemplate jdbcTemplate;
    private final CryptoConverter cryptoConverter;

    public LegacyDatasetImporter(JdbcTemplate jdbcTemplate, CryptoConverter cryptoConverter) {
        this.jdbcTemplate = jdbcTemplate;
        this.cryptoConverter = cryptoConverter;
    }

    /**
     * Imports all records from the legacy SQLite dataset into the PostgreSQL gtd schema.
     *
     * <p>Example: {@code importer.importDataset(dataset)}.</p>
     */
    public void importDataset(LegacySqliteDataset dataset) {
        importContexts(dataset.contexts());
        importItems(dataset.items());
        importItemAssets(dataset.itemAssets());
        importContextIconAssets(dataset.contextIconAssets());
        importNextActions(dataset.nextActions());
        importNextActionContexts(dataset.nextActionContexts());
        importCalendars(dataset.calendars());
        importMaintenanceRuns(dataset.maintenanceRuns());
        importGoogleCredentials(dataset.googleCredentials());
        importGoogleCalendars(dataset.googleCalendars());
    }

    /**
     * Deletes all rows from application tables in reverse dependency order.
     *
     * <p>Example: {@code importer.clearApplicationTables()}.</p>
     */
    public void clearApplicationTables() {
        jdbcTemplate.execute("DELETE FROM gtd.google_calendars");
        jdbcTemplate.execute("DELETE FROM gtd.google_credentials");
        jdbcTemplate.execute("DELETE FROM gtd.maintenance_runs");
        jdbcTemplate.execute("DELETE FROM gtd.calendars");
        jdbcTemplate.execute("DELETE FROM gtd.next_action_contexts");
        jdbcTemplate.execute("DELETE FROM gtd.next_actions");
        jdbcTemplate.execute("DELETE FROM gtd.project_items");
        jdbcTemplate.execute("DELETE FROM gtd.projects");
        jdbcTemplate.execute("DELETE FROM gtd.context_icon_assets");
        jdbcTemplate.execute("DELETE FROM gtd.item_assets");
        jdbcTemplate.execute("DELETE FROM gtd.items");
        jdbcTemplate.execute("DELETE FROM gtd.contexts");
    }

    private void importContexts(List<LegacyContextRecord> contexts) {
        String sql = "INSERT INTO gtd.contexts (id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)";
        for (LegacyContextRecord context : contexts) {
            jdbcTemplate.update(sql, context.id(), context.name(), toTimestamp(context.createdAt()), toTimestamp(context.updatedAt()), toTimestamp(context.deletedAt()));
        }
    }

    private void importItems(List<LegacyItemRecord> items) {
        String sql = "INSERT INTO gtd.items (id, title, body, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        for (LegacyItemRecord item : items) {
            jdbcTemplate.update(sql, item.id(), item.title(), item.body(), item.status(), toTimestamp(item.createdAt()), toTimestamp(item.updatedAt()), toTimestamp(item.deletedAt()));
        }
    }

    private void importItemAssets(List<LegacyItemAssetRecord> assets) {
        String sql = "INSERT INTO gtd.item_assets (id, item_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (LegacyItemAssetRecord asset : assets) {
            jdbcTemplate.update(sql, asset.id(), asset.itemId(), asset.fileName(), asset.originalFileName(), asset.contentType(), asset.size(), toTimestamp(asset.createdAt()), toTimestamp(asset.updatedAt()), toTimestamp(asset.deletedAt()));
        }
    }

    private void importContextIconAssets(List<LegacyContextIconAssetRecord> icons) {
        String sql = "INSERT INTO gtd.context_icon_assets (id, context_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (LegacyContextIconAssetRecord icon : icons) {
            jdbcTemplate.update(sql, icon.id(), icon.contextId(), icon.fileName(), icon.originalFileName(), icon.contentType(), icon.size(), toTimestamp(icon.createdAt()), toTimestamp(icon.updatedAt()), toTimestamp(icon.deletedAt()));
        }
    }

    private void importNextActions(List<LegacyNextActionRecord> nextActions) {
        String sql = "INSERT INTO gtd.next_actions (item_id, energy, estimated_time_minutes, date_start, date_end, time_start, time_end, all_day, deadline, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (LegacyNextActionRecord na : nextActions) {
            jdbcTemplate.update(sql, na.itemId(), na.energy(), na.estimatedTimeMinutes(), na.dateStart(), na.dateEnd(), na.timeStart(), na.timeEnd(), na.allDay(), na.deadline(), na.status(), toTimestamp(na.createdAt()), toTimestamp(na.updatedAt()), toTimestamp(na.deletedAt()));
        }
    }

    private void importNextActionContexts(List<LegacyNextActionContextRecord> joins) {
        String sql = "INSERT INTO gtd.next_action_contexts (next_action_id, context_id) VALUES (?, ?)";
        for (LegacyNextActionContextRecord join : joins) {
            jdbcTemplate.update(sql, join.nextActionId(), join.contextId());
        }
    }

    private void importCalendars(List<LegacyCalendarRecord> calendars) {
        String sql = "INSERT INTO gtd.calendars (item_id, scheduled_date, scheduled_time, date_start, date_end, time_start, time_end, all_day, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (LegacyCalendarRecord cal : calendars) {
            jdbcTemplate.update(sql, cal.itemId(), cal.scheduledDate(), cal.scheduledTime(), cal.dateStart(), cal.dateEnd(), cal.timeStart(), cal.timeEnd(), cal.allDay(), cal.status(), toTimestamp(cal.createdAt()), toTimestamp(cal.updatedAt()), toTimestamp(cal.deletedAt()));
        }
    }

    private void importMaintenanceRuns(List<LegacyMaintenanceRunRecord> runs) {
        String sql = "INSERT INTO gtd.maintenance_runs (name, last_run_at) VALUES (?, ?)";
        for (LegacyMaintenanceRunRecord run : runs) {
            jdbcTemplate.update(sql, run.name(), toTimestamp(run.lastRunAt()));
        }
    }

    private void importGoogleCredentials(List<LegacyGoogleCredentialRecord> credentials) {
        String sql = "INSERT INTO gtd.google_credentials (id, access_token, refresh_token, token_type, expires_at, scope) VALUES (?, ?, ?, ?, ?, ?)";
        for (LegacyGoogleCredentialRecord cred : credentials) {
            String encAccessToken = ensureEncrypted(cred.accessToken());
            String encRefreshToken = ensureEncrypted(cred.refreshToken());
            jdbcTemplate.update(sql, cred.id(), encAccessToken, encRefreshToken, cred.tokenType(), toTimestamp(cred.expiresAt()), cred.scope());
        }
    }

    private void importGoogleCalendars(List<LegacyGoogleCalendarRecord> calendars) {
        String sql = "INSERT INTO gtd.google_calendars (id, google_calendar_id, name, color_hex) VALUES (?, ?, ?, ?)";
        for (LegacyGoogleCalendarRecord gcal : calendars) {
            jdbcTemplate.update(sql, gcal.id(), gcal.googleCalendarId(), gcal.name(), gcal.colorHex());
        }
    }

    private String ensureEncrypted(String token) {
        if (token == null) return null;
        if (token.startsWith("gtdenc:v1:")) return token;
        return cryptoConverter.convertToDatabaseColumn(token);
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }
}
