package com.gtdonrails.api.sync;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.springframework.stereotype.Component;

@Component
public class RemoteSyncChangeApplier {

    private final RemoteStructuredChangeApplier structured;
    private final RemoteFileChangeApplier files;
    private final DomainChangeEventHub eventHub;
    private final CacheInvalidationService cacheInvalidation;

    public RemoteSyncChangeApplier(
        RemoteStructuredChangeApplier structured,
        RemoteFileChangeApplier files,
        DomainChangeEventHub eventHub,
        CacheInvalidationService cacheInvalidation
    ) {
        this.structured = structured;
        this.files = files;
        this.eventHub = eventHub;
        this.cacheInvalidation = cacheInvalidation;
    }

    /**
     * Routes change-feed entries to structured SQLite or filesystem persistence.
     *
     * <p>Example: {@code applier.apply(change)}.</p>
     */
    public void apply(SyncRemoteChange change) {
        if (files.supports(change.objectType())) {
            files.apply(change);
        } else {
            structured.apply(change);
        }
        invalidateCaches(change.objectType());
        eventHub.publish(change);
    }

    private void invalidateCaches(String objectType) {
        if ("contexts".equals(objectType)
            || "context_icon_assets".equals(objectType)
            || "context_icon_file".equals(objectType)) {
            cacheInvalidation.evictContextMutation();
            return;
        }
        if ("projects".equals(objectType)) {
            cacheInvalidation.evictProjectMutation();
            return;
        }
        if ("calendars".equals(objectType)) {
            cacheInvalidation.evictCalendarMutation();
            return;
        }
        cacheInvalidation.evictItemMutation();
    }
    public boolean supportsFile(String objectType) {
        return files.supports(objectType);
    }

}
