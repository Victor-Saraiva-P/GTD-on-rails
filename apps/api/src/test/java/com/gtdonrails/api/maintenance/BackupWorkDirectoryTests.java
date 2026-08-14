package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.nio.file.Files;

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

    @Test
    void rejectsSymlinkResolvingInsideSynchronizedDataRoot() throws Exception {
        Path dataRoot = Files.createDirectories(tempDirectory.resolve("synchronized-root"));
        Path synchronizedWork = Files.createDirectories(dataRoot.resolve("backup-work"));
        Path workLink = Files.createSymbolicLink(tempDirectory.resolve("work-link"), synchronizedWork);

        IllegalArgumentException failure = assertThrows(
            IllegalArgumentException.class,
            () -> BackupWorkDirectory.outsideDataRoot(dataRoot.toString(), workLink.toString()));

        assertTrue(failure.getMessage().contains("expected path outside synchronized data root"));
    }
}
