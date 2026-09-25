package com.gtdonrails.syncserver;

public record SyncFileContent(
    byte[] content,
    String relativePath,
    String sha256,
    String mediaType,
    long revision
) {
}
