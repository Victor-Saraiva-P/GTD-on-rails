package com.gtdonrails.syncserver;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SnapshotRestoreService {

    private final SyncObjectStore store;
    private final Path filesRoot;
    private final Path backupDirectory;

    @Autowired
    public SnapshotRestoreService(
        SyncObjectStore store,
        @Value("${gtd.sync-server.files-root}") String filesRoot,
        @Value("${gtd.sync-server.backup-directory}") String backupDirectory
    ) {
        this(store, Path.of(filesRoot), Path.of(backupDirectory));
    }

    SnapshotRestoreService(SyncObjectStore store, Path filesRoot, Path backupDirectory) {
        this.store = store;
        this.filesRoot = filesRoot.toAbsolutePath().normalize();
        this.backupDirectory = backupDirectory.toAbsolutePath().normalize();
    }

    /**
     * Restores one immutable server snapshot and returns the new dataset epoch.
     */
    public RestoreResult restore(String fileName) {
        Path snapshot = resolveSnapshot(fileName);
        Path stagingRoot = createStagingRoot();
        try {
            extract(snapshot, stagingRoot);
            Path database = stagingRoot.resolve("canonical.db");
            Path files = stagingRoot.resolve("files");
            validateExtracted(database);
            synchronized (store) {
                Path previousFiles = swapInFiles(files);
                try {
                    String epoch = store.restoreDatabase(database);
                    deleteTreeQuietly(previousFiles);
                    return new RestoreResult(epoch, store.currentCursor());
                } catch (RuntimeException exception) {
                    rollbackFiles(previousFiles);
                    throw exception;
                }
            }
        } finally {
            deleteTreeQuietly(stagingRoot);
        }
    }

    private Path resolveSnapshot(String fileName) {
        if (fileName == null || fileName.isBlank()) throw invalidSnapshot(fileName);
        Path raw = Path.of(fileName);
        if (raw.isAbsolute() || raw.getNameCount() != 1) throw invalidSnapshot(fileName);
        Path snapshot = backupDirectory.resolve(raw).normalize();
        if (!snapshot.startsWith(backupDirectory) || !snapshot.getFileName().toString().endsWith(".zip")) {
            throw invalidSnapshot(fileName);
        }
        if (!Files.isRegularFile(snapshot)) {
            throw new IllegalArgumentException(
                "backup file value '" + fileName + "' is invalid; expected existing snapshot in backup directory"
            );
        }
        return snapshot;
    }

    private Path createStagingRoot() {
        try {
            Path parent = filesRoot.getParent();
            if (parent == null) parent = backupDirectory;
            Files.createDirectories(parent);
            return Files.createTempDirectory(parent, ".restore-");
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create restore staging directory", exception);
        }
    }

    private void extract(Path snapshot, Path stagingRoot) {
        try (InputStream input = Files.newInputStream(snapshot);
             ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                Path target = safeEntry(stagingRoot, entry.getName());
                if (entry.isDirectory()) Files.createDirectories(target);
                else writeEntry(zip, target);
                zip.closeEntry();
            }
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to extract backup snapshot '" + snapshot + "'",
                exception
            );
        }
    }

    private Path safeEntry(Path stagingRoot, String name) {
        Path target = stagingRoot.resolve(name).normalize();
        if (!target.startsWith(stagingRoot)) {
            throw new IllegalArgumentException(
                "backup entry value '" + name + "' is invalid; expected path inside snapshot root"
            );
        }
        return target;
    }

    private void writeEntry(ZipInputStream zip, Path target) throws IOException {
        Files.createDirectories(target.getParent());
        Files.copy(zip, target, StandardCopyOption.REPLACE_EXISTING);
    }

    private void validateExtracted(Path database) {
        if (!Files.isRegularFile(database)) {
            throw new IllegalArgumentException(
                "backup snapshot is invalid; expected canonical.db entry"
            );
        }
    }

    private Path swapInFiles(Path stagedFiles) {
        Path parent = filesRoot.getParent();
        if (parent == null) throw new IllegalStateException("files root has no parent directory");
        Path previous = parent.resolve(filesRoot.getFileName() + ".pre-restore");
        deleteTreeQuietly(previous);
        try {
            Files.createDirectories(parent);
            if (Files.exists(filesRoot)) move(filesRoot, previous);
            if (Files.exists(stagedFiles)) move(stagedFiles, filesRoot);
            else Files.createDirectories(filesRoot);
            return previous;
        } catch (IOException | RuntimeException exception) {
            rollbackFiles(previous);
            throw new IllegalStateException("Failed to replace sync files during restore", exception);
        }
    }

    private void rollbackFiles(Path previous) {
        try {
            deleteTreeQuietly(filesRoot);
            if (Files.exists(previous)) move(previous, filesRoot);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to roll back sync files after restore failure", exception);
        }
    }

    private void move(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target);
        }
    }

    private void deleteTreeQuietly(Path root) {
        if (root == null || !Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        } catch (IOException ignored) {
            // Best effort cleanup for staging/rollback directories.
        }
    }

    private IllegalArgumentException invalidSnapshot(String value) {
        return new IllegalArgumentException(
            "backup file value '" + value + "' is invalid; expected snapshot file name only"
        );
    }

    public record RestoreResult(String datasetEpoch, long cursor) {
    }
}
