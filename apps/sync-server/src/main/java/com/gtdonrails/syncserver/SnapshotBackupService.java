package com.gtdonrails.syncserver;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class SnapshotBackupService {

    private final SyncObjectStore store;
    private final Path filesRoot;
    private final Path backupDirectory;
    private final RcloneBackupPublisher publisher;

    @Autowired
    public SnapshotBackupService(
        SyncObjectStore store,
        @Value("${gtd.sync-server.files-root}") String filesRoot,
        @Value("${gtd.sync-server.backup-directory}") String backupDirectory,
        RcloneBackupPublisher publisher
    ) {
        this(store, Path.of(filesRoot), Path.of(backupDirectory), publisher);
    }


    private SnapshotBackupService(
        SyncObjectStore store,
        Path filesRoot,
        Path backupDirectory,
        RcloneBackupPublisher publisher
    ) {
        this.store = store;
        this.filesRoot = filesRoot.toAbsolutePath().normalize();
        this.backupDirectory = backupDirectory.toAbsolutePath().normalize();
        this.publisher = publisher;
    }

    /**
     * Creates and publishes one immutable snapshot containing SQLite and files.
     *
     * <p>Example: {@code backups.createSnapshot()}.</p>
     */
    public synchronized Path createSnapshot() {
        try {
            Files.createDirectories(backupDirectory);
            Path finalPath;
            Path partialPath;
            synchronized (store) {
                finalPath = backupDirectory.resolve(snapshotFileName());
                partialPath = finalPath.resolveSibling(finalPath.getFileName() + ".partial");
                writeSnapshot(partialPath);
            }
            moveIntoPlace(partialPath, finalPath);
            publisher.publish(finalPath);
            return finalPath;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create immutable backup snapshot", exception);
        }
    }

    @Scheduled(cron = "${gtd.sync-server.backup-cron:0 0 2 * * *}")
    public void createScheduledSnapshot() {
        createSnapshot();
    }

    private void writeSnapshot(Path archive) throws IOException {
        Path stagingDatabase = Files.createTempFile(backupDirectory, "canonical-", ".db");
        try {
            store.snapshotDatabase(stagingDatabase);
            try (OutputStream output = Files.newOutputStream(archive);
                 ZipOutputStream zip = new ZipOutputStream(output)) {
                addFile(zip, stagingDatabase, "canonical.db");
                addBytes(zip, "manifest.json", manifestJson().getBytes(StandardCharsets.UTF_8));
                addFilesTree(zip);
            }
        } finally {
            Files.deleteIfExists(stagingDatabase);
        }
    }

    private void addFilesTree(ZipOutputStream zip) throws IOException {
        if (!Files.isDirectory(filesRoot)) return;
        List<Path> paths;
        try (var stream = Files.walk(filesRoot)) {
            paths = stream.filter(Files::isRegularFile).sorted(Comparator.naturalOrder()).toList();
        }
        for (Path path : paths) {
            String relative = filesRoot.relativize(path).toString().replace('\\', '/');
            addFile(zip, path, "files/" + relative);
        }
    }

    private void addFile(ZipOutputStream zip, Path file, String entryName) throws IOException {
        zip.putNextEntry(new ZipEntry(entryName));
        Files.copy(file, zip);
        zip.closeEntry();
    }

    private void addBytes(ZipOutputStream zip, String entryName, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(entryName));
        zip.write(bytes);
        zip.closeEntry();
    }

    private String manifestJson() {
        return "{"
            + "\"datasetEpoch\":\"" + store.datasetEpoch() + "\","
            + "\"cursor\":" + store.currentCursor() + ","
            + "\"createdAt\":\"" + Instant.now() + "\""
            + "}";
    }

    private String snapshotFileName() {
        String timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
            .replace(":", "-");
        return "gtd-snapshot-" + store.currentCursor() + "-" + timestamp + ".zip";
    }

    private void moveIntoPlace(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target);
        }
    }
}
