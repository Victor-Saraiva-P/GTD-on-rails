package com.gtdonrails.api.sync;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StructuredConflictResolutionService {

    private final JdbcTemplate jdbc;
    private final SyncServerGateway gateway;
    private final LocalSyncStateStore stateStore;
    private final RemoteStructuredChangeApplier applier;

    public StructuredConflictResolutionService(
        JdbcTemplate jdbc,
        SyncServerGateway gateway,
        LocalSyncStateStore stateStore,
        RemoteStructuredChangeApplier applier
    ) {
        this.jdbc = jdbc;
        this.gateway = gateway;
        this.stateStore = stateStore;
        this.applier = applier;
    }


    public SyncConflictDetail detail(LocalSyncStateStore.SyncConflictRecord conflict) {
        SyncServerGateway.SyncRemoteObject remote = currentRemote(conflict);
        LocalMutation local = latestLocalMutation(conflict);
        return new SyncConflictDetail(
            conflict.id(), conflict.objectType(), conflict.objectId(), conflict.remoteRevision(),
            conflict.createdAt(), false, null, local.payload(), remote.payload()
        );
    }

    @Transactional
    public void resolve(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncConflictChoice choice
    ) {
        if (choice == SyncConflictChoice.MERGED) {
            throw new IllegalArgumentException(
                "merged conflict resolution is invalid for structured metadata"
            );
        }
        SyncServerGateway.SyncRemoteObject remote = currentRemote(conflict);
        if (choice == SyncConflictChoice.REMOTE) acceptRemote(conflict, remote);
        else rebaseLocal(conflict, remote);
        stateStore.markConflictResolved(conflict.id());
    }

    private SyncServerGateway.SyncRemoteObject currentRemote(
        LocalSyncStateStore.SyncConflictRecord conflict
    ) {
        SyncServerGateway.SyncRemoteObject remote = gateway.object(
            conflict.objectType(), conflict.objectId()
        );
        if (remote.revision() != conflict.remoteRevision()) {
            throw new IllegalStateException(
                "sync conflict revision '" + conflict.remoteRevision()
                    + "' is stale; server is now at revision '" + remote.revision() + "'"
            );
        }
        return remote;
    }

    private void acceptRemote(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncServerGateway.SyncRemoteObject remote
    ) {
        supersede(conflict, "resolved using remote version");
        applier.apply(toChange(remote, conflict.remoteCursor()));
        stateStore.updateRevision(conflict.objectType(), conflict.objectId(), remote.revision());
    }

    private void rebaseLocal(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncServerGateway.SyncRemoteObject remote
    ) {
        LocalMutation mutation = latestLocalMutation(conflict);
        supersede(conflict, "superseded by manual conflict resolution");
        stateStore.updateRevision(conflict.objectType(), conflict.objectId(), remote.revision());
        enqueue(conflict, mutation);
    }

    private LocalMutation latestLocalMutation(
        LocalSyncStateStore.SyncConflictRecord conflict
    ) {
        String sql = """
            select operation, payload from sync_outbox
            where entity_type = ? and entity_id = ?
              and status in ('PENDING', 'PROCESSING', 'FAILED')
            order by created_at desc, id desc limit 1
            """;
        List<LocalMutation> mutations = jdbc.query(
            sql,
            (result, row) -> new LocalMutation(
                result.getString("operation"),
                result.getString("payload")
            ),
            conflict.objectType(),
            conflict.objectId()
        );
        return mutations.stream().findFirst().orElseThrow(() ->
            new IllegalStateException(
                "sync conflict '" + conflict.id() + "' has no local structured mutation to resolve"
            )
        );
    }

    private void supersede(
        LocalSyncStateStore.SyncConflictRecord conflict,
        String reason
    ) {
        jdbc.update(
            """
            update sync_outbox set status = 'COMPLETED', last_error = ?
            where entity_type = ? and entity_id = ?
              and status in ('PENDING', 'PROCESSING', 'FAILED')
            """,
            reason,
            conflict.objectType(),
            conflict.objectId()
        );
    }

    private void enqueue(
        LocalSyncStateStore.SyncConflictRecord conflict,
        LocalMutation mutation
    ) {
        jdbc.update(
            """
            insert into sync_outbox
                (operation_id, entity_type, entity_id, operation, payload, status, retry_count)
            values (?, ?, ?, ?, ?, 'PENDING', 0)
            """,
            UUID.randomUUID().toString(),
            conflict.objectType(),
            conflict.objectId(),
            mutation.operation(),
            mutation.payload()
        );
    }

    private SyncRemoteChange toChange(
        SyncServerGateway.SyncRemoteObject remote,
        long cursor
    ) {
        return new SyncRemoteChange(
            cursor,
            remote.objectType(),
            remote.objectId(),
            remote.revision(),
            remote.deleted() ? "DELETE" : "UPSERT",
            remote.payload(),
            remote.sha256(),
            remote.byteLength(),
            remote.mediaType()
        );
    }

    private record LocalMutation(String operation, String payload) {
    }
}
