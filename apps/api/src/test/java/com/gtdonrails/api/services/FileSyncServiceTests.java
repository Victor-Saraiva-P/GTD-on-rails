package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.sync.FileSyncState;
import com.gtdonrails.api.sync.FileConflictResolutionService;
import com.gtdonrails.api.sync.LocalSyncStateStore;
import com.gtdonrails.api.sync.SyncFileBaseStore;
import com.gtdonrails.api.sync.SyncFileOutboxEntry;
import com.gtdonrails.api.sync.SyncFileOutboxStore;
import com.gtdonrails.api.sync.SyncFileServerGateway;
import com.gtdonrails.api.sync.SyncServerConflictException;
import com.gtdonrails.api.sync.SyncServerGateway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class FileSyncServiceTests {

    @TempDir
    private Path tempDir;

    private FileSyncService service;
    private SyncFileBaseStore baseStore;
    private FileConflictResolutionService conflictResolver;

    @AfterEach
    void tearDown() {
        if (service != null) service.shutdown();
    }

    @Test
    void staysDisabledWhenSyncServerIsDisabled() throws Exception {
        service = newService(false, mock(SyncFileOutboxStore.class), mock(SyncFileServerGateway.class),
            mock(SyncServerGateway.class), mock(LocalSyncStateStore.class));

        service.syncOnStartup();

        assertEquals(FileSyncState.DISABLED, service.status().state());
    }

    @Test
    void syncNowPushesPendingBodyDocumentWithKnownBaseRevision() throws Exception {
        SyncFileOutboxStore outbox = mock(SyncFileOutboxStore.class);
        SyncFileServerGateway files = mock(SyncFileServerGateway.class);
        SyncServerGateway server = mock(SyncServerGateway.class);
        LocalSyncStateStore stateStore = mock(LocalSyncStateStore.class);
        SyncFileOutboxEntry entry = entry("body_document", "item-1", "items/item-1/body.md", "text/markdown");
        Files.createDirectories(tempDir.resolve("items/item-1"));
        Files.writeString(tempDir.resolve(entry.relativePath()), "# Notes");
        when(outbox.pending()).thenReturn(List.of(entry));
        when(outbox.pendingCount()).thenReturn(0L);
        when(stateStore.revision(entry.objectType(), entry.objectId())).thenReturn(4L);
        when(files.push(
            eq(entry.operationId()), eq(entry.objectType()), eq(entry.objectId()), eq(4L),
            eq("UPSERT"), eq(entry.relativePath()), eq(entry.contentType()), argThat(bytes -> java.util.Arrays.equals(bytes, "# Notes".getBytes(StandardCharsets.UTF_8)))
        )).thenReturn(new SyncServerGateway.SyncPushResult(5L, 12L));
        service = newService(true, outbox, files, server, stateStore);

        service.syncNow();

        verify(outbox).markProcessing(entry.id());
        verify(outbox).markCompleted(entry.id());
        verify(stateStore).updateRevision(entry.objectType(), entry.objectId(), 5L);
        verify(baseStore).save(eq(entry.objectType()), eq(entry.objectId()), eq(5L), any(byte[].class));
        assertEquals(FileSyncState.SYNCED, service.status().state());
    }

    @Test
    void offlineScheduledSyncWaitsForNextSchedulerCycleBeforeRetrying() {
        SyncFileOutboxStore outbox = mock(SyncFileOutboxStore.class);
        SyncFileServerGateway files = mock(SyncFileServerGateway.class);
        SyncServerGateway server = mock(SyncServerGateway.class);
        LocalSyncStateStore stateStore = mock(LocalSyncStateStore.class);
        when(outbox.pendingCount()).thenReturn(1L);
        service = newService(true, outbox, files, server, stateStore);
        when(server.state()).thenThrow(new IllegalStateException("offline"));

        service.requestScheduledSync();

        verify(server, after(150).times(1)).state();
    }

    @Test
    void conflictBecomesExplicitFailedEntryWithoutRetry() throws Exception {
        SyncFileOutboxStore outbox = mock(SyncFileOutboxStore.class);
        SyncFileServerGateway files = mock(SyncFileServerGateway.class);
        SyncServerGateway server = mock(SyncServerGateway.class);
        LocalSyncStateStore stateStore = mock(LocalSyncStateStore.class);
        SyncFileOutboxEntry entry = entry("body_document", "item-1", "items/item-1/body.md", "text/markdown");
        Files.createDirectories(tempDir.resolve("items/item-1"));
        Files.writeString(tempDir.resolve(entry.relativePath()), "local");
        when(outbox.pending()).thenReturn(List.of(entry));
        when(outbox.pendingCount()).thenReturn(0L);
        SyncServerConflictException conflict = new SyncServerConflictException("stale", 9L);
        when(files.push(any(), any(), any(), any(Long.class), any(), any(), any(), any())).thenThrow(conflict);
        service = newService(true, outbox, files, server, stateStore);
        when(conflictResolver.resolvePushConflict(entry, conflict))
            .thenReturn(new FileConflictResolutionService.Resolution(false, true));

        service.syncNow();

        verify(outbox).markFailed(entry.id(), "stale", false);
        assertEquals(FileSyncState.CONFLICT, service.status().state());
        assertEquals("stale", service.status().lastError());
    }

    @Test
    void transientFailureKeepsEntryPendingAfterRepeatedAttempts() throws Exception {
        SyncFileOutboxStore outbox = mock(SyncFileOutboxStore.class);
        SyncFileServerGateway files = mock(SyncFileServerGateway.class);
        SyncServerGateway server = mock(SyncServerGateway.class);
        LocalSyncStateStore stateStore = mock(LocalSyncStateStore.class);
        SyncFileOutboxEntry entry = repeatedFailureEntry();
        Files.createDirectories(tempDir.resolve("items/item-1/assets/asset-1"));
        Files.write(tempDir.resolve(entry.relativePath()), new byte[] {1, 2});
        when(outbox.pending()).thenReturn(List.of(entry));
        when(outbox.pendingCount()).thenReturn(1L);
        when(files.push(any(), any(), any(), any(Long.class), any(), any(), any(), any()))
            .thenThrow(new IllegalStateException("offline"));
        service = newService(true, outbox, files, server, stateStore);

        service.syncNow();

        verify(outbox).markFailed(entry.id(), "offline", true);
        assertEquals(FileSyncState.FAILED, service.status().state());
    }

    private SyncFileOutboxEntry repeatedFailureEntry() {
        return new SyncFileOutboxEntry(
            1L,
            UUID.randomUUID(),
            "item_asset_file",
            "asset-1",
            "UPSERT",
            "items/item-1/assets/asset-1/a.pdf",
            "application/pdf",
            10
        );
    }

    private FileSyncService newService(
        boolean enabled,
        SyncFileOutboxStore outbox,
        SyncFileServerGateway files,
        SyncServerGateway server,
        LocalSyncStateStore stateStore
    ) {
        baseStore = mock(SyncFileBaseStore.class);
        conflictResolver = mock(FileConflictResolutionService.class);
        if (enabled) {
            when(server.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch-1", 0L));
            when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("epoch-1", 0L));
        }
        return new FileSyncService(
            outbox, files, server, stateStore, baseStore, conflictResolver, tempDir.toString(), enabled
        );
    }

    private SyncFileOutboxEntry entry(
        String objectType,
        String objectId,
        String path,
        String contentType
    ) {
        return new SyncFileOutboxEntry(
            1L,
            UUID.randomUUID(),
            objectType,
            objectId,
            "UPSERT",
            path,
            contentType,
            0
        );
    }
}
