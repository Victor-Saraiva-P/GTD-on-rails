package com.gtdonrails.api.maintenance.cutover;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.Set;

import org.springframework.stereotype.Service;

@Service
public class LegacySqliteBackupService {

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH-mm-ss'Z'").withZone(java.time.ZoneOffset.UTC);
    private final Clock clock;

    public LegacySqliteBackupService(Clock clock) {
        this.clock = clock;
    }

    /**
     * Creates an immutable read-only backup of the legacy SQLite database before cutover import.
     *
     * <p>Example: {@code backupService.createBackup(sqlitePath, backupDir)}.</p>
     */
    public Path createBackup(Path sqlitePath, Path backupDirectory) {
        requireReadableFile(sqlitePath);
        try {
            Files.createDirectories(backupDirectory);
            Path backupFile = backupDirectory.resolve(backupFileName());
            Files.copy(sqlitePath, backupFile, StandardCopyOption.REPLACE_EXISTING);
            makeImmutable(backupFile);
            return backupFile;
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to create immutable backup for SQLite database at '%s'".formatted(sqlitePath), exception);
        }
    }

    private void requireReadableFile(Path path) {
        if (path == null || !Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException(
                "SQLite backup source path value '%s' is invalid; expected readable regular file".formatted(path));
        }
    }

    private String backupFileName() {
        return "gtd-legacy-sqlite-%s.db".formatted(TIMESTAMP_FORMAT.format(clock.instant()));
    }

    private void makeImmutable(Path file) throws IOException {
        Set<PosixFilePermission> readOnly = EnumSet.of(PosixFilePermission.OWNER_READ);
        Files.setPosixFilePermissions(file, readOnly);
    }
}
