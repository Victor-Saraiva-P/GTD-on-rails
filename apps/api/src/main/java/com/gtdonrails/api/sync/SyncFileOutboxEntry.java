package com.gtdonrails.api.sync;

import java.util.UUID;

public record SyncFileOutboxEntry(
    long id,
    UUID operationId,
    String objectType,
    String objectId,
    String operation,
    String relativePath,
    String contentType,
    int retryCount
) {
}
