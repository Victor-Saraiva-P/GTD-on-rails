package com.gtdonrails.api.dtos.sync;

import java.time.Instant;

public record DataSyncStatusDto(
    DataSyncState state,
    boolean pending,
    boolean running,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {}
