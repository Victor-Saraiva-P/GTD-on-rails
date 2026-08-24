package com.gtdonrails.api.dtos.sync;

public enum FileSyncState {
    DISABLED,
    BOOTSTRAPPING,
    SYNCED,
    PENDING,
    SYNCING,
    FAILED
}
