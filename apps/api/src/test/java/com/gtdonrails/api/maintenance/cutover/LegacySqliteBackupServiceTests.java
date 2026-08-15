package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LegacySqliteBackupServiceTests {

    @TempDir
    private Path tempDir;

    private Path sqlitePath;
    private Path backupDir;
    private Clock clock;
    private LegacySqliteBackupService backupService;

    @BeforeEach
    void setUp() throws IOException {
        sqlitePath = tempDir.resolve("gtd-on-rails.db");
        Files.writeString(sqlitePath, "legacy-sqlite-content");
        backupDir = tempDir.resolve("backups");
        clock = Clock.fixed(Instant.parse("2026-08-14T23:00:00Z"), ZoneOffset.UTC);
        backupService = new LegacySqliteBackupService(clock);
    }

    @Test
    void createsImmutableBackupAndPreservesOriginal() throws IOException {
        Path backupFile = backupService.createBackup(sqlitePath, backupDir);

        assertNotNull(backupFile);
        assertTrue(Files.exists(backupFile));
        assertEquals("legacy-sqlite-content", Files.readString(backupFile));
        assertEquals("legacy-sqlite-content", Files.readString(sqlitePath));
        assertTrue(backupFile.getFileName().toString().startsWith("gtd-legacy-sqlite-2026-08-14T23-00-00Z"));

        try {
            Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(backupFile);
            assertEquals(Set.of(PosixFilePermission.OWNER_READ), permissions);
        } catch (UnsupportedOperationException ignored) {
            assertFalse(Files.isWritable(backupFile));
        }
    }

    @Test
    void rejectsMissingOrUnreadableSqlitePath() {
        Path missing = tempDir.resolve("missing.db");
        assertThrows(IllegalArgumentException.class, () -> backupService.createBackup(missing, backupDir));
        assertThrows(IllegalArgumentException.class, () -> backupService.createBackup(null, backupDir));
    }
}
