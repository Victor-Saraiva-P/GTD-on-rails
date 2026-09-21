package com.gtdonrails.api.sync;

import org.springframework.stereotype.Component;

@Component
public class RemoteSyncChangeApplier {

    private final RemoteStructuredChangeApplier structured;
    private final RemoteFileChangeApplier files;

    public RemoteSyncChangeApplier(
        RemoteStructuredChangeApplier structured,
        RemoteFileChangeApplier files
    ) {
        this.structured = structured;
        this.files = files;
    }

    /**
     * Routes change-feed entries to structured SQLite or filesystem persistence.
     *
     * <p>Example: {@code applier.apply(change)}.</p>
     */
    public void apply(SyncRemoteChange change) {
        if (files.supports(change.objectType())) {
            files.apply(change);
            return;
        }
        structured.apply(change);
    }
    public boolean supportsFile(String objectType) {
        return files.supports(objectType);
    }

}
