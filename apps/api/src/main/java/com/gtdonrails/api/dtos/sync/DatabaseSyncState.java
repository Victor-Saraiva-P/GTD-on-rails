package com.gtdonrails.api.dtos.sync;

public enum DatabaseSyncState {
    DISABLED,
    SYNCED,
    PENDING,
    SYNCING,
    FAILED,
    CONFLICT,
    REBOOTSTRAP_REQUIRED
}
