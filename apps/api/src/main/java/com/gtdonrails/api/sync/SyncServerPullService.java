package com.gtdonrails.api.sync;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class SyncServerPullService {

    private static final int PAGE_SIZE = 200;

    private final SyncServerGateway gateway;
    private final LocalSyncStateStore stateStore;
    private final RemoteSyncChangeApplier applier;
    private final FileConflictResolutionService fileConflicts;
    private final TransactionTemplate transactions;

    public SyncServerPullService(
        SyncServerGateway gateway,
        LocalSyncStateStore stateStore,
        RemoteSyncChangeApplier applier,
        FileConflictResolutionService fileConflicts,
        TransactionTemplate transactions
    ) {
        this.gateway = gateway;
        this.stateStore = stateStore;
        this.applier = applier;
        this.fileConflicts = fileConflicts;
        this.transactions = transactions;
    }


    public void validateDatasetEpoch() {
        SyncServerGateway.SyncRemoteState remote = gateway.state();
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        validatedEpoch(local.datasetEpoch(), remote.datasetEpoch());
    }

    /**
     * Pulls the ordered change feed until the local cursor catches the server.
     *
     * <p>Example: {@code pullService.pullAll()}.</p>
     */
    public void pullAll() {
        SyncServerGateway.SyncRemoteState remote = gateway.state();
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        String epoch = validatedEpoch(local.datasetEpoch(), remote.datasetEpoch());
        long cursor = local.cursor();
        while (cursor < remote.cursor()) {
            long next = pullPage(epoch, cursor);
            if (next <= cursor) break;
            cursor = next;
        }
    }

    private long pullPage(String epoch, long cursor) {
        SyncServerGateway.SyncPullPage page = gateway.changesAfter(cursor, PAGE_SIZE);
        Long result = transactions.execute(status -> {
            applyChanges(page.changes());
            stateStore.updateClientState(epoch, page.cursor());
            return page.cursor();
        });
        if (result == null) throw new IllegalStateException("sync pull transaction returned no cursor");
        return result;
    }

    private void applyChanges(List<SyncRemoteChange> changes) {
        for (SyncRemoteChange change : changes) applyChange(change);
    }

    private void applyChange(SyncRemoteChange change) {
        long localRevision = stateStore.revision(change.objectType(), change.objectId());
        if (change.revision() <= localRevision) return;
        if (stateStore.hasPendingMutation(change.objectType(), change.objectId())) {
            if (applier.supportsFile(change.objectType())) {
                FileConflictResolutionService.Resolution resolution = fileConflicts.resolvePullConflict(change);
                if (resolution.mergedAutomatically()) return;
            } else {
                stateStore.recordConflict(change);
            }
            return;
        }
        applier.apply(change);
        stateStore.updateRevision(change.objectType(), change.objectId(), change.revision());
    }

    private String validatedEpoch(String localEpoch, String remoteEpoch) {
        if (localEpoch == null || localEpoch.isBlank()) return remoteEpoch;
        if (localEpoch.equals(remoteEpoch)) return localEpoch;
        throw new SyncDatasetEpochMismatchException(localEpoch, remoteEpoch);
    }
}
