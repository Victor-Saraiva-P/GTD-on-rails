package com.gtdonrails.api.dtos.sync;

import java.time.Instant;

public record FileSyncStatusDto(
    FileSyncState state,
    boolean pending,
    boolean running,
    long pendingCount,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {}
