package com.gtdonrails.api.sync;

import java.util.List;

import com.gtdonrails.api.entities.SyncOutboxEvent;

public interface SyncServerGateway {

    SyncPushResult push(SyncOutboxEvent event, long baseRevision);

    SyncRemoteState state();

    SyncPullPage changesAfter(long cursor, int limit);

    SyncRemoteObject object(String objectType, String objectId);

    record SyncPushResult(long revision, long cursor) {
    }

    record SyncRemoteState(String datasetEpoch, long cursor) {
    }

    record SyncPullPage(long cursor, List<SyncRemoteChange> changes) {
    }

    record SyncRemoteObject(
        String objectType,
        String objectId,
        long revision,
        String payload,
        String sha256,
        Long byteLength,
        String mediaType,
        boolean deleted
    ) {
    }
}
