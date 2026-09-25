package com.gtdonrails.api.sync;

public class SyncServerConflictException extends RuntimeException {

    private final long currentRevision;

    public SyncServerConflictException(String message, long currentRevision) {
        super(message);
        this.currentRevision = currentRevision;
    }

    public long currentRevision() {
        return currentRevision;
    }
}
