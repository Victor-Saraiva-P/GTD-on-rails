package com.gtdonrails.syncserver;

import java.util.UUID;

public record SyncMutation(
    UUID operationId,
    String objectType,
    String objectId,
    long baseRevision,
    String operation,
    String payload,
    String sha256,
    Long byteLength,
    String mediaType
) {
}
