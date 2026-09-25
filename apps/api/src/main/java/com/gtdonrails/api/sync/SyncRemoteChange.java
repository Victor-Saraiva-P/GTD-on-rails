package com.gtdonrails.api.sync;

public record SyncRemoteChange(
    long cursor,
    String objectType,
    String objectId,
    long revision,
    String operation,
    String payload,
    String sha256,
    Long byteLength,
    String mediaType
) {
}
