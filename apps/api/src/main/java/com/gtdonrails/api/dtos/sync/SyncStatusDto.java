package com.gtdonrails.api.dtos.sync;

import com.gtdonrails.api.dtos.assets.AssetSyncStatusDto;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncStatus;

public record SyncStatusDto(
    AssetSyncStatusDto assets,
    PersistenceSyncStatus persistence
) {
}
