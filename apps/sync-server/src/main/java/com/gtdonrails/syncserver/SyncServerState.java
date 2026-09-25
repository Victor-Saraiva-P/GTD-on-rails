package com.gtdonrails.syncserver;

public record SyncServerState(String datasetEpoch, long cursor) {
}
