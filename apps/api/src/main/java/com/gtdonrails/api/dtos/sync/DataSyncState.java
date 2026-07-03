package com.gtdonrails.api.dtos.sync;

public enum DataSyncState {
    DISABLED,
    BOOTSTRAPPING,
    SYNCED,
    PENDING,
    SYNCING,
    FAILED
}
