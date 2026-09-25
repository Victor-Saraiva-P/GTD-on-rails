package com.gtdonrails.syncserver;

public class SyncConflictException extends RuntimeException {

    private final long currentRevision;

    public SyncConflictException(String objectType, String objectId, long baseRevision, long currentRevision) {
        super(
            "base revision '" + baseRevision + "' for object '" + objectType + ":" + objectId
                + "' is stale; expected current revision '" + currentRevision + "'"
        );
        this.currentRevision = currentRevision;
    }

    public long currentRevision() {
        return currentRevision;
    }
}
