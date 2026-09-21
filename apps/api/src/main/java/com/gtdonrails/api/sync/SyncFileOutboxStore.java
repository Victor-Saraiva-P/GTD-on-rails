package com.gtdonrails.api.sync;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class SyncFileOutboxStore {

    private final JdbcTemplate jdbc;

    public SyncFileOutboxStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Queues an idempotent file upsert for asynchronous server synchronization.
     *
     * <p>Example: {@code store.enqueueUpsert("body_document", itemId, path, "text/markdown")}.</p>
     */
    public void enqueueUpsert(String objectType, String objectId, String relativePath, String contentType) {
        enqueue(objectType, objectId, "UPSERT", relativePath, contentType);
    }

    public void enqueueDelete(String objectType, String objectId, String relativePath, String contentType) {
        enqueue(objectType, objectId, "DELETE", relativePath, contentType);
    }

    public List<SyncFileOutboxEntry> pending() {
        return jdbc.query(
            """
            select id, operation_id, object_type, object_id, operation, relative_path, content_type, retry_count
            from sync_file_outbox where status = 'PENDING' order by created_at asc, id asc
            """,
(result, row) -> mapEntry(result)
        );
    }


    public Optional<SyncFileOutboxEntry> activeFor(String objectType, String objectId) {
        String sql = """
            select id, operation_id, object_type, object_id, operation, relative_path, content_type, retry_count
            from sync_file_outbox
            where object_type = ? and object_id = ? and status in ('PENDING', 'PROCESSING', 'FAILED')
            order by created_at desc, id desc limit 1
            """;
        List<SyncFileOutboxEntry> entries = jdbc.query(sql, (result, row) -> mapEntry(result), objectType, objectId);
        return entries.stream().findFirst();
    }

    public void supersedeObject(String objectType, String objectId, String reason) {
        jdbc.update(
            """
            update sync_file_outbox set status = 'COMPLETED', last_error = ?
            where object_type = ? and object_id = ? and status in ('PENDING', 'PROCESSING', 'FAILED')
            """,
            reason, objectType, objectId
        );
    }

    public long pendingCount() {
        Long count = jdbc.queryForObject(
            "select count(*) from sync_file_outbox where status = 'PENDING'",
            Long.class
        );
        return count == null ? 0L : count;
    }

    public void markProcessing(long id) {
        updateStatus(id, "PROCESSING", null, false);
    }

    public void markCompleted(long id) {
        updateStatus(id, "COMPLETED", null, false);
    }

    public void markFailed(long id, String error, boolean retry) {
        jdbc.update(
            """
            update sync_file_outbox
            set status = ?, last_error = ?, retry_count = retry_count + 1
            where id = ?
            """,
            retry ? "PENDING" : "FAILED",
            error,
            id
        );
    }


    private SyncFileOutboxEntry mapEntry(java.sql.ResultSet result) throws java.sql.SQLException {
        return new SyncFileOutboxEntry(
            result.getLong("id"),
            UUID.fromString(result.getString("operation_id")),
            result.getString("object_type"),
            result.getString("object_id"),
            result.getString("operation"),
            result.getString("relative_path"),
            result.getString("content_type"),
            result.getInt("retry_count")
        );
    }

    private void enqueue(
        String objectType,
        String objectId,
        String operation,
        String relativePath,
        String contentType
    ) {
        jdbc.update(
            """
            insert into sync_file_outbox
                (operation_id, object_type, object_id, operation, relative_path, content_type, status, retry_count)
            values (?, ?, ?, ?, ?, ?, 'PENDING', 0)
            """,
            UUID.randomUUID().toString(),
            objectType,
            objectId,
            operation,
            relativePath,
            contentType
        );
    }

    private void updateStatus(long id, String status, String error, boolean incrementRetry) {
        jdbc.update(
            "update sync_file_outbox set status = ?, last_error = ? where id = ?",
            status,
            error,
            id
        );
    }
}
