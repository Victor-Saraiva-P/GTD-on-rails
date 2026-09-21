package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SyncServerAdminServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void overviewIncludesCanonicalObjectsFilesAndBackups() throws Exception {
        Fixture fixture = fixture();
        fixture.store().apply(new SyncMutation(
            UUID.randomUUID(), "items", "item-1", 0, "UPSERT",
            "{\"title\":\"One\"}", null, null, null
        ));
        Path body = fixture.filesRoot().resolve("items/item-1/body.md");
        Files.createDirectories(body.getParent());
        Files.writeString(body, "# Body");
        Files.createDirectories(fixture.backupRoot());
        Files.writeString(fixture.backupRoot().resolve("snapshot.zip"), "backup");

        SyncServerAdminService.Overview overview = fixture.admin().overview();

        assertEquals(1, overview.objectCount());
        assertEquals(1, overview.changeCount());
        assertEquals(1, overview.operationCount());
        assertEquals(1, overview.fileCount());
        assertEquals(1, overview.backupCount());
        assertEquals(1L, overview.objectTypes().get("items"));
    }

    @Test
    void listsObjectsAndRecentChanges() {
        Fixture fixture = fixture();
        fixture.store().apply(new SyncMutation(
            UUID.randomUUID(), "items", "item-1", 0, "UPSERT",
            "{\"title\":\"One\"}", null, null, null
        ));

        var objects = fixture.admin().objects("items", false, 20);
        var changes = fixture.admin().recentChanges(20);

        assertEquals(1, objects.size());
        assertEquals("item-1", objects.getFirst().objectId());
        assertEquals(1, changes.size());
        assertEquals("UPSERT", changes.getFirst().operation());
    }

    @Test
    void deletesOnlySnapshotsInsideBackupDirectory() throws Exception {
        Fixture fixture = fixture();
        Files.createDirectories(fixture.backupRoot());
        Path backup = fixture.backupRoot().resolve("snapshot.zip");
        Files.writeString(backup, "backup");

        fixture.admin().deleteBackup("snapshot.zip");

        assertTrue(Files.notExists(backup));
        assertThrows(
            IllegalArgumentException.class,
            () -> fixture.admin().deleteBackup("../outside.zip")
        );
    }

    private Fixture fixture() {
        Path database = tempDirectory.resolve("canonical.db");
        Path files = tempDirectory.resolve("files");
        Path backups = tempDirectory.resolve("backups");
        SyncObjectStore store = new SyncObjectStore(database);
        SyncServerAdminService admin = new SyncServerAdminService(
            store,
            database.toString(),
            files.toString(),
            backups.toString()
        );
        return new Fixture(store, admin, files, backups);
    }

    private record Fixture(
        SyncObjectStore store,
        SyncServerAdminService admin,
        Path filesRoot,
        Path backupRoot
    ) {
    }
}
