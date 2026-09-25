package com.gtdonrails.syncserver;

import java.util.UUID;

public record SyncFileMutation(
    UUID operationId,
    String objectType,
    String objectId,
    long baseRevision,
    String operation,
    String relativePath,
    String sha256,
    String mediaType
) {
}
