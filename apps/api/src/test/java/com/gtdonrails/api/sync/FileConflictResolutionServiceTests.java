package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class FileConflictResolutionServiceTests {

    @Mock
    private SyncFileServerGateway filesGateway;
    @Mock
    private SyncServerGateway objectsGateway;
    @Mock
    private SyncFileOutboxStore outbox;
    @Mock
    private LocalSyncStateStore stateStore;
    @Mock
    private SyncLocalFileStore localFiles;
    @Mock
    private SyncFileBaseStore bases;
    @Mock
    private SyncConflictSnapshotStore snapshots;
    @Mock
    private MarkdownThreeWayMerger merger;

    @Test
    void detailIncludesSnapshotsForMarkdownAndHidesContentForBinaryFiles() {
        LocalSyncStateStore.SyncConflictRecord markdown = conflict("body_document");
        when(snapshots.read("body_document", "item-1", 5L)).thenReturn(
            new SyncConflictSnapshotStore.ConflictFiles(
                Optional.of(bytes("base")), bytes("local"), bytes("remote")
            )
        );

        SyncConflictDetail markdownDetail = service().detail(markdown);
        SyncConflictDetail binaryDetail = service().detail(conflict("item_asset_file"));

        assertTrue(markdownDetail.mergeSupported());
        assertEquals("base", markdownDetail.baseContent());
        assertEquals("local", markdownDetail.localContent());
        assertEquals("remote", markdownDetail.remoteContent());
        assertFalse(binaryDetail.mergeSupported());
    }

    @Test
    void pushConflictAgainstDeletedRemotePreservesConflict() {
        SyncFileOutboxEntry entry = entry("UPSERT");
        SyncServerConflictException conflict = new SyncServerConflictException("stale", 5L);
        when(objectsGateway.object("body_document", "item-1")).thenReturn(remote(true));
        when(objectsGateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 9L));
        when(localFiles.read(entry.relativePath())).thenReturn(bytes("local"));
        when(stateStore.revision("body_document", "item-1")).thenReturn(4L);
        when(bases.read("body_document", "item-1", 4L))
            .thenReturn(Optional.of(new SyncFileBaseStore.BaseSnapshot(4L, bytes("base"))));

        FileConflictResolutionService.Resolution resolution = service().resolvePushConflict(entry, conflict);

        assertTrue(resolution.pendingConflict());
        assertFalse(resolution.mergedAutomatically());
        verify(snapshots).save(eq("body_document"), eq("item-1"), eq(5L), any(), any(), any());
        verify(stateStore).recordConflict(any(SyncRemoteChange.class), any());
    }

    @Test
    void pushConflictAutomaticallyMergesCleanMarkdown() {
        SyncFileOutboxEntry entry = entry("UPSERT");
        SyncServerConflictException conflict = new SyncServerConflictException("stale", 5L);
        SyncFileServerGateway.RemoteFileContent remoteFile = new SyncFileServerGateway.RemoteFileContent(
            bytes("remote"), entry.relativePath(), "sha", "text/markdown", 5L
        );
        preparePushConflict(entry, remoteFile);
        when(merger.merge("base", "local", "remote"))
            .thenReturn(new MarkdownThreeWayMerger.MergeResult(true, "merged"));

        FileConflictResolutionService.Resolution resolution = service().resolvePushConflict(entry, conflict);

        assertTrue(resolution.mergedAutomatically());
        verify(localFiles).write(entry.relativePath(), bytes("merged"));
        verify(outbox).supersedeObject("body_document", "item-1", "superseded by automatic three-way merge");
        verify(stateStore).updateRevision("body_document", "item-1", 5L);
        verify(bases).save("body_document", "item-1", 5L, bytes("remote"));
        verify(outbox).enqueueUpsert("body_document", "item-1", entry.relativePath(), "text/markdown");
    }

    @Test
    void pushConflictPreservesOverlappingMarkdownConflict() {
        SyncFileOutboxEntry entry = entry("UPSERT");
        SyncServerConflictException conflict = new SyncServerConflictException("stale", 5L);
        SyncFileServerGateway.RemoteFileContent remoteFile = new SyncFileServerGateway.RemoteFileContent(
            bytes("remote"), entry.relativePath(), "sha", "text/markdown", 5L
        );
        preparePushConflict(entry, remoteFile);
        when(merger.merge("base", "local", "remote"))
            .thenReturn(new MarkdownThreeWayMerger.MergeResult(false, null));

        FileConflictResolutionService.Resolution resolution = service().resolvePushConflict(entry, conflict);

        assertTrue(resolution.pendingConflict());
        verify(snapshots).save(eq("body_document"), eq("item-1"), eq(5L), any(), any(), any());
    }

    @Test
    void remoteResolutionAcceptsCanonicalRemoteFileAndFinishesConflict() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict("body_document");
        SyncFileOutboxEntry entry = entry("UPSERT");
        when(objectsGateway.object("body_document", "item-1")).thenReturn(remote(false));
        when(outbox.activeFor("body_document", "item-1")).thenReturn(Optional.of(entry));
        when(snapshots.read("body_document", "item-1", 5L)).thenReturn(
            new SyncConflictSnapshotStore.ConflictFiles(
                Optional.of(bytes("base")), bytes("local"), bytes("remote")
            )
        );

        service().resolvePendingConflict(conflict, SyncConflictChoice.REMOTE, null);

        verify(outbox).supersedeObject("body_document", "item-1", "resolved using remote version");
        verify(localFiles).write("items/item-1/body.md", bytes("remote"));
        verify(bases).save("body_document", "item-1", 5L, bytes("remote"));
        verify(stateStore).markConflictResolved(7L);
        verify(snapshots).delete("body_document", "item-1", 5L);
    }

    @Test
    void localResolutionRebasesMutationOnCurrentRemoteRevision() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict("body_document");
        SyncFileOutboxEntry entry = entry("UPSERT");
        when(objectsGateway.object("body_document", "item-1")).thenReturn(remote(false));
        when(outbox.activeFor("body_document", "item-1")).thenReturn(Optional.of(entry));
        when(snapshots.read("body_document", "item-1", 5L)).thenReturn(
            new SyncConflictSnapshotStore.ConflictFiles(
                Optional.of(bytes("base")), bytes("local"), bytes("remote")
            )
        );

        service().resolvePendingConflict(conflict, SyncConflictChoice.LOCAL, null);

        verify(stateStore).updateRevision("body_document", "item-1", 5L);
        verify(bases).save("body_document", "item-1", 5L, bytes("remote"));
        verify(localFiles).write(entry.relativePath(), bytes("local"));
        verify(outbox).enqueueUpsert("body_document", "item-1", entry.relativePath(), "text/markdown");
        verify(stateStore).markConflictResolved(7L);
    }

    @Test
    void mergedResolutionRebasesProvidedMarkdown() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict("body_document");
        SyncFileOutboxEntry entry = entry("UPSERT");
        when(objectsGateway.object("body_document", "item-1")).thenReturn(remote(false));
        when(outbox.activeFor("body_document", "item-1")).thenReturn(Optional.of(entry));
        when(snapshots.read("body_document", "item-1", 5L)).thenReturn(
            new SyncConflictSnapshotStore.ConflictFiles(
                Optional.of(bytes("base")), bytes("local"), bytes("remote")
            )
        );

        service().resolvePendingConflict(conflict, SyncConflictChoice.MERGED, "merged manually");

        verify(localFiles).write(entry.relativePath(), bytes("merged manually"));
        verify(outbox).enqueueUpsert("body_document", "item-1", entry.relativePath(), "text/markdown");
    }

    @Test
    void mergedResolutionIsRejectedForBinaryConflict() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict("item_asset_file");
        SyncFileOutboxEntry entry = new SyncFileOutboxEntry(
            1L, UUID.randomUUID(), "item_asset_file", "item-1", "UPSERT",
            "items/item-1/assets/a/file.pdf", "application/pdf", 0
        );
        when(objectsGateway.object("item_asset_file", "item-1")).thenReturn(new SyncServerGateway.SyncRemoteObject(
            "item_asset_file", "item-1", 5L, entry.relativePath(), "sha", 10L, "application/pdf", false
        ));
        when(outbox.activeFor("item_asset_file", "item-1")).thenReturn(Optional.of(entry));
        when(snapshots.read("item_asset_file", "item-1", 5L)).thenReturn(
            new SyncConflictSnapshotStore.ConflictFiles(Optional.empty(), bytes("local"), bytes("remote"))
        );

        assertThrows(
            IllegalArgumentException.class,
            () -> service().resolvePendingConflict(conflict, SyncConflictChoice.MERGED, "invalid")
        );
    }

    private void preparePushConflict(
        SyncFileOutboxEntry entry,
        SyncFileServerGateway.RemoteFileContent remoteFile
    ) {
        when(objectsGateway.object("body_document", "item-1")).thenReturn(remote(false));
        when(objectsGateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 9L));
        when(localFiles.read(entry.relativePath())).thenReturn(bytes("local"));
        when(stateStore.revision("body_document", "item-1")).thenReturn(4L);
        when(bases.read("body_document", "item-1", 4L))
            .thenReturn(Optional.of(new SyncFileBaseStore.BaseSnapshot(4L, bytes("base"))));
        when(filesGateway.read("body_document", "item-1")).thenReturn(remoteFile);
    }

    private FileConflictResolutionService service() {
        return new FileConflictResolutionService(
            filesGateway,
            objectsGateway,
            outbox,
            stateStore,
            localFiles,
            bases,
            snapshots,
            merger
        );
    }

    private SyncFileOutboxEntry entry(String operation) {
        return new SyncFileOutboxEntry(
            1L,
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "body_document",
            "item-1",
            operation,
            "items/item-1/body.md",
            "text/markdown",
            0
        );
    }

    private LocalSyncStateStore.SyncConflictRecord conflict(String type) {
        return new LocalSyncStateStore.SyncConflictRecord(
            7L, type, "item-1", "operation-1", 5L, 9L, Instant.EPOCH
        );
    }

    private SyncServerGateway.SyncRemoteObject remote(boolean deleted) {
        return new SyncServerGateway.SyncRemoteObject(
            "body_document",
            "item-1",
            5L,
            "items/item-1/body.md",
            "sha",
            10L,
            "text/markdown",
            deleted
        );
    }

    private byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
