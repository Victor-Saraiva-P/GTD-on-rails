package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipFile;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SnapshotBackupServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void snapshotContainsCanonicalDatabaseManifestAndFiles() throws Exception {
        Path dataRoot = tempDirectory.resolve("server");
        Path filesRoot = dataRoot.resolve("files");
        Files.createDirectories(filesRoot.resolve("items/item-1"));
        Files.writeString(filesRoot.resolve("items/item-1/body.md"), "# Notes");
        SyncObjectStore store = new SyncObjectStore(dataRoot.resolve("canonical.db"));
        store.apply(new SyncMutation(
            UUID.randomUUID(), "items", "item-1", 0, "UPSERT", "{}", null, null, null
        ));
        SnapshotBackupService backups = new SnapshotBackupService(
            store,
            filesRoot.toString(),
            dataRoot.resolve("backups").toString(),
            new RcloneBackupPublisher(false, "rclone", "gdrive:test")
        );

        Path archive = backups.createSnapshot();

        assertTrue(Files.isRegularFile(archive));
        assertTrue(archive.getFileName().toString().endsWith(".zip"));
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            Set<String> entries = new HashSet<>();
            zip.stream().forEach(entry -> entries.add(entry.getName()));
            assertTrue(entries.contains("canonical.db"));
            assertTrue(entries.contains("manifest.json"));
            assertTrue(entries.contains("files/items/item-1/body.md"));
        }
    }
}
