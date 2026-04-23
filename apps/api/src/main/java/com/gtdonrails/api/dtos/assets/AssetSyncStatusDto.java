package com.gtdonrails.api.dtos.assets;

import java.time.Instant;

public record AssetSyncStatusDto(
    AssetSyncState state,
    boolean pending,
    boolean running,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {
}
