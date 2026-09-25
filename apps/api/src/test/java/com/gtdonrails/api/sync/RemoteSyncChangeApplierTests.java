package com.gtdonrails.api.sync;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class RemoteSyncChangeApplierTests {

    @Mock
    private RemoteStructuredChangeApplier structured;

    @Mock
    private RemoteFileChangeApplier files;

    @Mock
    private DomainChangeEventHub eventHub;

    @Mock
    private CacheInvalidationService cacheInvalidation;

    @Test
    void appliesStructuredChangeBeforeInvalidationAndPublication() {
        SyncRemoteChange change = change("items");
        when(files.supports("items")).thenReturn(false);
        RemoteSyncChangeApplier applier = applier();

        applier.apply(change);

        verify(structured).apply(change);
        verify(cacheInvalidation).evictItemMutation();
        verify(eventHub).publish(change);
    }

    @Test
    void appliesFileChangeThroughFileApplier() {
        SyncRemoteChange change = change("body_document");
        when(files.supports("body_document")).thenReturn(true);
        RemoteSyncChangeApplier applier = applier();

        applier.apply(change);

        verify(files).apply(change);
        verify(cacheInvalidation).evictItemMutation();
        verify(eventHub).publish(change);
    }

    @Test
    void invalidatesContextCachesForRemoteContextChanges() {
        SyncRemoteChange change = change("contexts");
        when(files.supports("contexts")).thenReturn(false);

        applier().apply(change);

        verify(cacheInvalidation).evictContextMutation();
    }

    @Test
    void invalidatesProjectCachesForRemoteProjectChanges() {
        SyncRemoteChange change = change("projects");
        when(files.supports("projects")).thenReturn(false);

        applier().apply(change);

        verify(cacheInvalidation).evictProjectMutation();
    }

    @Test
    void invalidatesCalendarCachesForRemoteCalendarChanges() {
        SyncRemoteChange change = change("calendars");
        when(files.supports("calendars")).thenReturn(false);

        applier().apply(change);

        verify(cacheInvalidation).evictCalendarMutation();
    }

    private RemoteSyncChangeApplier applier() {
        return new RemoteSyncChangeApplier(structured, files, eventHub, cacheInvalidation);
    }

    private SyncRemoteChange change(String objectType) {
        return new SyncRemoteChange(
            1L,
            objectType,
            "00000000-0000-0000-0000-000000000001",
            2L,
            "UPSERT",
            "{}",
            null,
            null,
            null
        );
    }
}
