package com.gtdonrails.api.maintenance;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

record BackupWorkDirectory(Path path) {

    BackupWorkDirectory {
        path = path.toAbsolutePath().normalize();
    }

    static BackupWorkDirectory outsideDataRoot(String dataRoot, String workDirectory) {
        Path synchronizedRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        BackupWorkDirectory candidate = new BackupWorkDirectory(Path.of(workDirectory));
        if (candidate.path.startsWith(synchronizedRoot)) {
            throw new IllegalArgumentException(
                "backup work directory value '%s' is invalid; expected path outside synchronized data root '%s'"
                    .formatted(candidate.path, synchronizedRoot));
        }
        return candidate;
    }

    Path createBackupFile(Path backupDirectory, String prefix, String suffix) {
        try {
            Files.createDirectories(path);
            Files.createDirectories(backupDirectory);
            requireSameFileStore(backupDirectory);
            return Files.createTempFile(path, prefix, suffix);
        } catch (IOException exception) {
            throw invalidDirectory(exception);
        }
    }

    Path createTemporaryFile(String prefix, String suffix) {
        try {
            ensureExists();
            return Files.createTempFile(path, prefix, suffix);
        } catch (IOException exception) {
            throw invalidDirectory(exception);
        }
    }

    void ensureExists() {
        try {
            Files.createDirectories(path);
        } catch (IOException exception) {
            throw invalidDirectory(exception);
        }
    }

    private void requireSameFileStore(Path backupDirectory) throws IOException {
        if (Files.getFileStore(path).equals(Files.getFileStore(backupDirectory))) return;
        throw new IOException(
            "backup directory value '%s' is invalid; expected same filesystem as work directory"
                .formatted(backupDirectory));
    }

    private IllegalStateException invalidDirectory(IOException exception) {
        return new IllegalStateException(
            "backup work directory value '%s' is invalid; expected writable local directory: %s"
                .formatted(path, exception.getMessage()), exception);
    }
}
