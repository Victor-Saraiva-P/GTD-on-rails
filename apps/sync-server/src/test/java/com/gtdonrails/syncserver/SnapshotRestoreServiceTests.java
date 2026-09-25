package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SnapshotRestoreServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void restoreRollsBackCanonicalDatabaseAndFilesAndRotatesEpoch() throws Exception {
        Path dataRoot = tempDirectory.resolve("server");
        Path filesRoot = dataRoot.resolve("files");
        Path backupRoot = dataRoot.resolve("backups");
        SyncObjectStore store = new SyncObjectStore(dataRoot.resolve("canonical.db"));
        SyncFileService files = new SyncFileService(store, filesRoot.toString());
        String originalEpoch = store.datasetEpoch();

        push(files, 0L, "# revision one");
        SnapshotBackupService backups = new SnapshotBackupService(
            store,
            filesRoot.toString(),
            backupRoot.toString(),
            new RcloneBackupPublisher(false, "rclone", "gdrive:test")
        );
        Path snapshot = backups.createSnapshot();
        push(files, 1L, "# revision two");
        assertEquals(2L, store.object("body_document", "item-1").orElseThrow().revision());

        SnapshotRestoreService.RestoreResult result = new SnapshotRestoreService(
            store, filesRoot, backupRoot
        ).restore(snapshot.getFileName().toString());

        assertEquals(1L, result.cursor());
        assertEquals(1L, store.object("body_document", "item-1").orElseThrow().revision());
        assertEquals(
            "# revision one",
            Files.readString(filesRoot.resolve("items/item-1/body.md"), StandardCharsets.UTF_8)
        );
        assertNotEquals(originalEpoch, result.datasetEpoch());
        assertEquals(result.datasetEpoch(), store.datasetEpoch());
        assertTrue(Files.isRegularFile(snapshot));
    }

    private void push(SyncFileService files, long baseRevision, String text) {
        files.apply(
            new SyncFileMutation(
                UUID.randomUUID(),
                "body_document",
                "item-1",
                baseRevision,
                "UPSERT",
                "items/item-1/body.md",
                null,
                "text/markdown"
            ),
            text.getBytes(StandardCharsets.UTF_8)
        );
    }
}
