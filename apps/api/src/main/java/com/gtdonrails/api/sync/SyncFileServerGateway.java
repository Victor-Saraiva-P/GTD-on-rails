package com.gtdonrails.api.sync;

import java.util.UUID;

public interface SyncFileServerGateway {

    SyncServerGateway.SyncPushResult push(PushRequest request);

    RemoteFileContent read(String objectType, String objectId);

    final class PushRequest {

        private final SyncFileOutboxEntry entry;
        private final long baseRevision;
        private final byte[] content;

        public PushRequest(SyncFileOutboxEntry entry, long baseRevision, byte[] content) {
            this.entry = entry;
            this.baseRevision = baseRevision;
            this.content = content;
        }

        public UUID operationId() {
            return entry.operationId();
        }

        public String objectType() {
            return entry.objectType();
        }

        public String objectId() {
            return entry.objectId();
        }

        public long baseRevision() {
            return baseRevision;
        }

        public String operation() {
            return entry.operation();
        }

        public String relativePath() {
            return entry.relativePath();
        }

        public String contentType() {
            return entry.contentType();
        }

        public byte[] content() {
            return content;
        }
    }

    final class RemoteFileContent {

        private final byte[] content;
        private final String relativePath;
        private final String sha256;
        private final String mediaType;
        private final long revision;

        public RemoteFileContent(
            byte[] content,
            String relativePath,
            String sha256,
            String mediaType,
            long revision
        ) {
            this.content = content;
            this.relativePath = relativePath;
            this.sha256 = sha256;
            this.mediaType = mediaType;
            this.revision = revision;
        }

        public byte[] content() {
            return content;
        }

        public String relativePath() {
            return relativePath;
        }

        public String sha256() {
            return sha256;
        }

        public String mediaType() {
            return mediaType;
        }

        public long revision() {
            return revision;
        }
    }
}
