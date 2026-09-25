package com.gtdonrails.api.sync;

import java.util.Arrays;
import java.util.Objects;
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

    record RemoteFileContent(
        byte[] content,
        String relativePath,
        String sha256,
        String mediaType,
        long revision
    ) {
        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof RemoteFileContent(
                byte[] otherContent,
                String otherRelativePath,
                String otherSha256,
                String otherMediaType,
                long otherRevision
            ))) {
                return false;
            }
            return revision == otherRevision
                && Arrays.equals(content, otherContent)
                && Objects.equals(relativePath, otherRelativePath)
                && Objects.equals(sha256, otherSha256)
                && Objects.equals(mediaType, otherMediaType);
        }

        @Override
        public int hashCode() {
            return 31 * Objects.hash(relativePath, sha256, mediaType, revision) + Arrays.hashCode(content);
        }

        @Override
        public String toString() {
            return "RemoteFileContent[relativePath=" + relativePath + ", sha256=" + sha256
                + ", mediaType=" + mediaType + ", revision=" + revision
                + ", contentBytes=" + (content == null ? 0 : content.length) + "]";
        }
    }
}
