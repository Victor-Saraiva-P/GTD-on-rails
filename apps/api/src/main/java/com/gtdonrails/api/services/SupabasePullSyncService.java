package com.gtdonrails.api.services;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pulls and reconciles remote Supabase PostgreSQL tables into the local SQLite database.
 *
 * <p>Example: {@code pullSyncService.pullAll()}.</p>
 */
@Service
@ConditionalOnProperty(name = "gtd.sync.database.enabled", havingValue = "true")
public class SupabasePullSyncService {

    private static final Logger logger = LoggerFactory.getLogger(SupabasePullSyncService.class);

    private final JdbcTemplate supabaseJdbc;
    private final JdbcTemplate sqliteJdbc;

    /**
     * Creates a Supabase pull sync service with required JDBC templates.
     *
     * @example new SupabasePullSyncService(supabaseJdbc, sqliteJdbc)
     */
    @Autowired
    public SupabasePullSyncService(
        @Qualifier("supabaseJdbcTemplate") JdbcTemplate supabaseJdbc,
        @Qualifier("jdbcTemplate") JdbcTemplate sqliteJdbc
    ) {
        this.supabaseJdbc = supabaseJdbc;
        this.sqliteJdbc = sqliteJdbc;
    }

    /**
     * Pulls all domain entity tables from Supabase PostgreSQL into local SQLite.
     *
     * <p>Example: {@code pullSyncService.pullAll()}.</p>
     */
    @Transactional
    public void pullAll() {
        logger.info("Starting Supabase pull sync into local SQLite");
        pullContexts();
        pullItems();
        pullItemAssets();
        pullContextIconAssets();
        pullProjects();
        pullProjectItems();
        pullNextActions();
        pullNextActionContexts();
        pullCalendars();
        logger.info("Completed Supabase pull sync into local SQLite");
    }

    private void pullContexts() {
        String sql = "SELECT id::text, name, created_at::text, updated_at::text, deleted_at::text FROM gtd.contexts";
        String upsert = """
            INSERT INTO contexts (id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullItems() {
        String sql = "SELECT id::text, title, body, status, created_at::text, updated_at::text, deleted_at::text FROM gtd.items";
        String upsert = """
            INSERT INTO items (id, title, body, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, status = EXCLUDED.status,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
            rs.getString(5), rs.getString(6), rs.getString(7)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullItemAssets() {
        String sql = "SELECT id::text, item_id::text, file_name, original_file_name, content_type, size, created_at::text, updated_at::text, deleted_at::text FROM gtd.item_assets";
        String upsert = """
            INSERT INTO item_assets (id, item_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET item_id = EXCLUDED.item_id, file_name = EXCLUDED.file_name,
            original_file_name = EXCLUDED.original_file_name, content_type = EXCLUDED.content_type,
            size = EXCLUDED.size, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
            rs.getString(5), rs.getLong(6), rs.getString(7), rs.getString(8), rs.getString(9)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullContextIconAssets() {
        String sql = "SELECT id::text, context_id::text, file_name, original_file_name, content_type, size, created_at::text, updated_at::text, deleted_at::text FROM gtd.context_icon_assets";
        String upsert = """
            INSERT INTO context_icon_assets (id, context_id, file_name, original_file_name, content_type, size, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET context_id = EXCLUDED.context_id, file_name = EXCLUDED.file_name,
            original_file_name = EXCLUDED.original_file_name, content_type = EXCLUDED.content_type,
            size = EXCLUDED.size, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
            rs.getString(5), rs.getLong(6), rs.getString(7), rs.getString(8), rs.getString(9)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullProjects() {
        String sql = "SELECT item_id::text, deadline::text, status, done_date::text, done_time::text, created_at::text, updated_at::text, deleted_at::text FROM gtd.projects";
        String upsert = """
            INSERT INTO projects (item_id, deadline, status, done_date, done_time, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (item_id) DO UPDATE SET deadline = EXCLUDED.deadline, status = EXCLUDED.status,
            done_date = EXCLUDED.done_date, done_time = EXCLUDED.done_time, created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), toDate(rs.getString(2)), rs.getString(3), toDate(rs.getString(4)),
            toTime(rs.getString(5)), rs.getString(6), rs.getString(7), rs.getString(8)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullProjectItems() {
        String sql = "SELECT item_id::text, project_id::text FROM gtd.project_items";
        String upsert = "INSERT INTO project_items (item_id, project_id) VALUES (?, ?) ON CONFLICT (item_id) DO UPDATE SET project_id = EXCLUDED.project_id";
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] { rs.getString(1), rs.getString(2) });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullNextActions() {
        String sql = "SELECT item_id::text, energy, estimated_time_minutes, date_start::text, date_end::text, time_start::text, time_end::text, all_day, deadline::text, status, created_at::text, updated_at::text, deleted_at::text FROM gtd.next_actions";
        String upsert = """
            INSERT INTO next_actions (item_id, energy, estimated_time_minutes, date_start, date_end, time_start, time_end, all_day, deadline, status, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (item_id) DO UPDATE SET energy = EXCLUDED.energy, estimated_time_minutes = EXCLUDED.estimated_time_minutes,
            date_start = EXCLUDED.date_start, date_end = EXCLUDED.date_end, time_start = EXCLUDED.time_start,
            time_end = EXCLUDED.time_end, all_day = EXCLUDED.all_day, deadline = EXCLUDED.deadline,
            status = EXCLUDED.status, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), rs.getObject(2), rs.getLong(3), toDate(rs.getString(4)),
            toDate(rs.getString(5)), toTime(rs.getString(6)), toTime(rs.getString(7)), rs.getBoolean(8) ? 1 : 0,
            toDate(rs.getString(9)), rs.getString(10), rs.getString(11), rs.getString(12), rs.getString(13)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullNextActionContexts() {
        String sql = "SELECT next_action_id::text, context_id::text FROM gtd.next_action_contexts";
        String upsert = "INSERT INTO next_action_contexts (next_action_id, context_id) VALUES (?, ?) ON CONFLICT (next_action_id, context_id) DO NOTHING";
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] { rs.getString(1), rs.getString(2) });
        sqliteJdbc.update("""
            DELETE FROM next_action_contexts
            WHERE next_action_id NOT IN (
                SELECT entity_id FROM sync_outbox
                WHERE entity_type = 'next_actions' AND status IN ('PENDING', 'PROCESSING')
            )
            """);
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private void pullCalendars() {
        String sql = "SELECT item_id::text, scheduled_date::text, scheduled_time::text, date_start::text, date_end::text, time_start::text, time_end::text, all_day, status, created_at::text, updated_at::text, deleted_at::text FROM gtd.calendars";
        String upsert = """
            INSERT INTO calendars (item_id, scheduled_date, scheduled_time, date_start, date_end, time_start, time_end, all_day, status, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (item_id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date, scheduled_time = EXCLUDED.scheduled_time,
            date_start = EXCLUDED.date_start, date_end = EXCLUDED.date_end, time_start = EXCLUDED.time_start,
            time_end = EXCLUDED.time_end, all_day = EXCLUDED.all_day, status = EXCLUDED.status,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            """;
        List<Object[]> rows = supabaseJdbc.query(sql, (rs, i) -> new Object[] {
            rs.getString(1), toDate(rs.getString(2)), toTime(rs.getString(3)), toDate(rs.getString(4)),
            toDate(rs.getString(5)), toTime(rs.getString(6)), toTime(rs.getString(7)), rs.getBoolean(8) ? 1 : 0,
            rs.getString(9), rs.getString(10), rs.getString(11), rs.getString(12)
        });
        rows.forEach(params -> sqliteJdbc.update(upsert, params));
    }

    private java.sql.Date toDate(String text) {
        return text != null ? java.sql.Date.valueOf(text) : null;
    }

    private java.sql.Time toTime(String text) {
        if (text == null) {
            return null;
        }
        java.time.LocalTime localTime = java.time.LocalTime.parse(text);
        return java.sql.Time.valueOf(localTime.withNano(0));
    }
}
