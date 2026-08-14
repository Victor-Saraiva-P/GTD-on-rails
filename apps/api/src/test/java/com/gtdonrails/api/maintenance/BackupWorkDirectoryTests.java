package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupWorkDirectoryTests {

    @TempDir
    private Path tempDirectory;

    @Test
    void rejectsWorkDirectoryInsideSynchronizedDataRoot() {
        Path dataRoot = tempDirectory.resolve("synchronized-root");
        Path workDirectory = dataRoot.resolve("backup-work");

        IllegalArgumentException failure = assertThrows(
            IllegalArgumentException.class,
            () -> BackupWorkDirectory.outsideDataRoot(dataRoot.toString(), workDirectory.toString()));

        assertTrue(failure.getMessage().contains(workDirectory.toString()));
        assertTrue(failure.getMessage().contains("expected path outside synchronized data root"));
    }
}
