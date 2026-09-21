package com.gtdonrails.api.dtos.sync;

import java.time.Instant;

public record DatabaseSyncStatusDto(
    DatabaseSyncState state,
    boolean pending,
    boolean running,
    int pendingCount,
    int conflictCount,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {}
