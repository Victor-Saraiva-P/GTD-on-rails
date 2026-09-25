package com.gtdonrails.api.sync;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LocalSyncStateStore {

    private final JdbcTemplate jdbc;

    public LocalSyncStateStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long revision(String objectType, String objectId) {
        return jdbc.query(
            "select revision from sync_object_revisions where object_type = ? and object_id = ?",
            result -> result.next() ? result.getLong(1) : 0L,
            objectType,
            objectId
        );
    }

    public void updateRevision(String objectType, String objectId, long revision) {
        jdbc.update(
            """
            insert into sync_object_revisions (object_type, object_id, revision)
            values (?, ?, ?)
            on conflict (object_type, object_id) do update set revision = excluded.revision
            """,
            objectType,
            objectId,
            revision
        );
    }

    public SyncClientState clientState() {
        return jdbc.query(
            "select dataset_epoch, cursor from sync_client_state where id = 1",
            result -> {
                if (!result.next()) return new SyncClientState(null, 0L);
                return new SyncClientState(result.getString(1), result.getLong(2));
            }
        );
    }

    public void updateClientState(String datasetEpoch, long cursor) {
        jdbc.update(
            """
            insert into sync_client_state (id, dataset_epoch, cursor) values (1, ?, ?)
            on conflict (id) do update set dataset_epoch = excluded.dataset_epoch, cursor = excluded.cursor
            """,
            datasetEpoch,
            cursor
        );
    }

    public boolean hasPendingMutation(String objectType, String objectId) {
        return structuredPendingCount(objectType, objectId) + filePendingCount(objectType, objectId) > 0;
    }

    private int structuredPendingCount(String objectType, String objectId) {
        Integer count = jdbc.queryForObject(
            "select count(*) from sync_outbox where entity_type = ? and entity_id = ? and status in ('PENDING', 'PROCESSING')",
            Integer.class, objectType, objectId);
        return count == null ? 0 : count;
    }

    private int filePendingCount(String objectType, String objectId) {
        Integer count = jdbc.queryForObject(
            "select count(*) from sync_file_outbox where object_type = ? and object_id = ? and status in ('PENDING', 'PROCESSING')",
            Integer.class, objectType, objectId);
        return count == null ? 0 : count;
    }

    public Optional<String> pendingOperationId(String objectType, String objectId) {
        Optional<String> structured = pendingStructuredOperationId(objectType, objectId);
        return structured.isPresent() ? structured : pendingFileOperationId(objectType, objectId);
    }

    private Optional<String> pendingStructuredOperationId(String objectType, String objectId) {
        String sql = "select operation_id from sync_outbox where entity_type = ? and entity_id = ? and status in ('PENDING', 'PROCESSING') order by created_at asc limit 1";
        return queryPendingOperation(sql, objectType, objectId);
    }

    private Optional<String> pendingFileOperationId(String objectType, String objectId) {
        String sql = "select operation_id from sync_file_outbox where object_type = ? and object_id = ? and status in ('PENDING', 'PROCESSING') order by created_at asc limit 1";
        return queryPendingOperation(sql, objectType, objectId);
    }

    private Optional<String> queryPendingOperation(String sql, String objectType, String objectId) {
        return jdbc.query(
            sql,
            result -> result.next() ? Optional.ofNullable(result.getString(1)) : Optional.empty(),
            objectType,
            objectId);
    }

    public void recordConflict(SyncRemoteChange change) {
        recordConflict(
            change,
            pendingOperationId(change.objectType(), change.objectId()).orElse(null)
        );
    }

    public void recordConflict(SyncRemoteChange change, String localOperationId) {
        jdbc.update(
            """
            insert into sync_conflicts
                (object_type, object_id, local_operation_id, remote_revision, remote_cursor, status)
            values (?, ?, ?, ?, ?, 'PENDING')
            on conflict (object_type, object_id, remote_revision) do update set
                local_operation_id = coalesce(sync_conflicts.local_operation_id, excluded.local_operation_id)
            """,
            change.objectType(), change.objectId(), localOperationId, change.revision(), change.cursor()
        );
    }



    public int pendingConflictCount() {
        Integer count = jdbc.queryForObject(
            "select count(*) from sync_conflicts where status = 'PENDING'",
            Integer.class
        );
        return count == null ? 0 : count;
    }

    public List<SyncConflictRecord> pendingConflicts() {
        return jdbc.query(
            """
            select id, object_type, object_id, local_operation_id, remote_revision, remote_cursor, created_at
            from sync_conflicts where status = 'PENDING' order by created_at asc, id asc
            """,
            (result, row) -> new SyncConflictRecord(
                result.getLong("id"),
                result.getString("object_type"),
                result.getString("object_id"),
                result.getString("local_operation_id"),
                result.getLong("remote_revision"),
                result.getLong("remote_cursor"),
                result.getTimestamp("created_at").toInstant()
            )
        );
    }

    public Optional<SyncConflictRecord> pendingConflict(long id) {
        String sql = """
            select id, object_type, object_id, local_operation_id, remote_revision, remote_cursor, created_at
            from sync_conflicts where id = ? and status = 'PENDING'
            """;
        List<SyncConflictRecord> records = jdbc.query(sql, (result, row) -> new SyncConflictRecord(
            result.getLong("id"), result.getString("object_type"), result.getString("object_id"),
            result.getString("local_operation_id"), result.getLong("remote_revision"),
            result.getLong("remote_cursor"), result.getTimestamp("created_at").toInstant()
        ), id);
        return records.stream().findFirst();
    }

    public void markConflictResolved(long id) {
        jdbc.update("update sync_conflicts set status = 'RESOLVED' where id = ?", id);
    }

    public record SyncConflictRecord(
        long id,
        String objectType,
        String objectId,
        String localOperationId,
        long remoteRevision,
        long remoteCursor,
        Instant createdAt
    ) {
    }

    public record SyncClientState(String datasetEpoch, long cursor) {
    }
}
