package com.gtdonrails.api.persistence.bootstrap.model;

import java.time.Instant;

public record PersistenceSyncStatus(
    PersistenceSyncState state,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {
}
