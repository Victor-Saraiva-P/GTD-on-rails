package com.gtdonrails.api.sync;

import java.time.Instant;

public record SyncConflictDetail(
    long id,
    String objectType,
    String objectId,
    long remoteRevision,
    Instant createdAt,
    boolean mergeSupported,
    String baseContent,
    String localContent,
    String remoteContent
) {
}
