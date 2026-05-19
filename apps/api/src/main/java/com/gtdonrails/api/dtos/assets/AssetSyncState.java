package com.gtdonrails.api.dtos.assets;

public enum AssetSyncState {
    DISABLED,
    BOOTSTRAPPING,
    SYNCED,
    PENDING,
    SYNCING,
    FAILED
}
