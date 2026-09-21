package com.gtdonrails.api.sync;

import java.util.UUID;

public interface SyncFileServerGateway {

    SyncServerGateway.SyncPushResult push(
        UUID operationId,
        String objectType,
        String objectId,
        long baseRevision,
        String operation,
        String relativePath,
        String contentType,
        byte[] content
    );

    RemoteFileContent read(String objectType, String objectId);

    record RemoteFileContent(
        byte[] content,
        String relativePath,
        String sha256,
        String mediaType,
        long revision
    ) {
    }
}
