package com.gtdonrails.api.sync;

import com.gtdonrails.api.entities.SyncOutboxEvent;
import org.springframework.stereotype.Service;

@Service
public class SyncServerPushService {

    private final SyncServerGateway gateway;
    private final LocalSyncStateStore stateStore;

    public SyncServerPushService(SyncServerGateway gateway, LocalSyncStateStore stateStore) {
        this.gateway = gateway;
        this.stateStore = stateStore;
    }

    /**
     * Pushes one structured outbox mutation using optimistic base revision.
     *
     * <p>Example: {@code pushService.pushEvent(event)}.</p>
     */
    public void pushEvent(SyncOutboxEvent event) {
        long baseRevision = stateStore.revision(event.getEntityType(), event.getEntityId());
        try {
            SyncServerGateway.SyncPushResult result = gateway.push(event, baseRevision);
            stateStore.updateRevision(event.getEntityType(), event.getEntityId(), result.revision());
        } catch (SyncServerConflictException conflict) {
            recordConflict(event, conflict);
            throw conflict;
        }
    }

    private void recordConflict(SyncOutboxEvent event, SyncServerConflictException conflict) {
        SyncServerGateway.SyncRemoteState remote = gateway.state();
        stateStore.recordConflict(new SyncRemoteChange(
            remote.cursor(),
            event.getEntityType(),
            event.getEntityId(),
            conflict.currentRevision(),
            "UPSERT",
            null,
            null,
            null,
            null
        ));
    }
}
