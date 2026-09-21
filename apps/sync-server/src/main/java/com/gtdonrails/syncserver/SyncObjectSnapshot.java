package com.gtdonrails.syncserver;

public record SyncObjectSnapshot(
    String objectType,
    String objectId,
    long revision,
    String payload,
    String sha256,
    Long byteLength,
    String mediaType,
    boolean deleted
) {
}
