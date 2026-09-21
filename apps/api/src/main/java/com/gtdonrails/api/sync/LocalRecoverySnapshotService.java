package com.gtdonrails.api.sync;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class LocalRecoverySnapshotService {

    private final JdbcTemplate jdbc;
    private final Path dataRoot;
    private final Path stateRoot;

    public LocalRecoverySnapshotService(
        JdbcTemplate jdbc,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${gtd.sync.state-directory:${user.home}/.local/state/gtd-on-rails}") String stateRoot
    ) {
        this.jdbc = jdbc;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.stateRoot = Path.of(stateRoot).toAbsolutePath().normalize();
    }

    public Path create() {
        Path backupDir = stateRoot.resolve("rebootstrap-backups");
        try {
            Files.createDirectories(backupDir);
            Path database = Files.createTempFile(backupDir, "local-", ".db");
            vacuumInto(database);
            Path archive = backupDir.resolve(fileName());
            writeArchive(archive, database);
            Files.deleteIfExists(database);
            return archive;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create local recovery snapshot", exception);
        }
    }

    private void vacuumInto(Path database) {
        String target = database.toString().replace("'", "''");
        jdbc.execute("VACUUM INTO '" + target + "'");
    }

    private void writeArchive(Path archive, Path database) throws IOException {
        try (OutputStream output = Files.newOutputStream(archive);
             ZipOutputStream zip = new ZipOutputStream(output)) {
            addFile(zip, database, "gtd.db");
            for (Path path : physicalFiles()) {
                addFile(zip, path, "files/" + dataRoot.relativize(path).toString().replace('\\', '/'));
            }
        }
    }

    private List<Path> physicalFiles() throws IOException {
        if (!Files.isDirectory(dataRoot)) return List.of();
        try (var stream = Files.walk(dataRoot)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(this::isPhysicalContent)
                .sorted(Comparator.naturalOrder())
                .toList();
        }
    }

    private boolean isPhysicalContent(Path path) {
        String relative = dataRoot.relativize(path).toString().replace('\\', '/');
        return relative.startsWith("items/")
            || relative.startsWith("assets/contexts/");
    }

    private void addFile(ZipOutputStream zip, Path path, String name) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        Files.copy(path, zip);
        zip.closeEntry();
    }

    private String fileName() {
        String time = DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-");
        return "before-rebootstrap-" + time + ".zip";
    }
}
