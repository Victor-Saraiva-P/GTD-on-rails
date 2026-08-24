package com.gtdonrails.api.maintenance;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import com.gtdonrails.api.services.DatabaseIdentityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("staging")
public class StagingBackupRestoreService {

    private final Path backupDirectory;
    private final BackupWorkDirectory workDirectory;
    private final PostgresConnection connection;
    private final DatabaseIdentityService databaseIdentityService;
    private final PostgresCommandRunner commandRunner;

    @Autowired
    public StagingBackupRestoreService(
        @Value("${gtd.backup.directory:${gtd.data.root-directory}/backups}") String backupDirectory,
        @Value("${gtd.backup.work-directory:${user.home}/.cache/gtd-on-rails/backup-work}") String workDirectory,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${spring.datasource.url}") String jdbcUrl,
        @Value("${spring.datasource.username}") String username,
        @Value("${spring.datasource.password}") String password,
        DatabaseIdentityService databaseIdentityService,
        PostgresCommandRunner commandRunner
    ) {
        this(Path.of(backupDirectory), BackupWorkDirectory.outsideDataRoot(dataRoot, workDirectory), new PostgresConnection(jdbcUrl, username, password), databaseIdentityService, commandRunner);
    }

    StagingBackupRestoreService(
        Path backupDirectory,
        BackupWorkDirectory workDirectory,
        PostgresConnection connection,
        DatabaseIdentityService databaseIdentityService,
        PostgresCommandRunner commandRunner
    ) {
        this.backupDirectory = backupDirectory.toAbsolutePath().normalize();
        this.workDirectory = workDirectory;
        this.connection = connection;
        this.databaseIdentityService = databaseIdentityService;
        this.commandRunner = commandRunner;
    }

    /** Restores a synchronized logical archive into the guarded staging database.
     *
     * <p>Example: {@code restoreService.restore("gtd-backup-2026-08-11T02-00-00Z-daily.dump")}.</p>
     */
    public RestoreResult restore(String archiveName) {
        Path archive = archivePath(archiveName);
        requireArchive(archive);
        databaseIdentityService.require("STAGING");
        restoreArchive(archive);
        databaseIdentityService.require("STAGING");
        return new RestoreResult(archive.getFileName().toString(), "STAGING");
    }

    private void restoreArchive(Path archive) {
        try {
            restoreWithEnvironment(archive);
        } catch (IOException | RuntimeException exception) {
            throw restoreFailure(archive, exception);
        }
    }

    private void restoreWithEnvironment(Path archive) throws IOException {
        workDirectory.ensureExists();
        try (PostgresCommandEnvironment environment = PostgresCommandEnvironment.open(connection, workDirectory.path())) {
            commandRunner.run("pg_restore", List.of("--list", "--no-password", archive.toString()), environment.environment());
            restoreValidatedArchive(archive, environment);
        }
    }

    private void restoreValidatedArchive(Path archive, PostgresCommandEnvironment environment) throws IOException {
        Path metadata = workDirectory.createTemporaryFile(".gtd-restore-", ".sql");
        try {
            commandRunner.run("pg_restore", metadataArguments(archive, metadata), environment.environment());
            requireKnownArchiveIdentity(metadata);
            commandRunner.run("pg_restore", connection.restoreArguments(archive), environment.environment());
        } finally {
            Files.deleteIfExists(metadata);
        }
    }

    private IllegalStateException restoreFailure(Path archive, Exception exception) {
        return new IllegalStateException(
            "staging restore archive value '%s' is invalid; expected readable validated archive: %s"
                .formatted(archive, exception.getMessage()), exception);
    }

    private Path archivePath(String archiveName) {
        if (archiveName == null || !archiveName.matches("[A-Za-z0-9._-]+\\.dump")) {
            throw new IllegalArgumentException("backup archive value '%s' is invalid; expected a file name ending in .dump".formatted(archiveName));
        }
        return backupDirectory.resolve(archiveName).normalize();
    }

    private void requireArchive(Path archive) {
        if (!Files.isRegularFile(archive) || !Files.isReadable(archive)) {
            throw new IllegalArgumentException("backup archive value '%s' is invalid; expected readable regular archive".formatted(archive));
        }
    }

    private List<String> metadataArguments(Path archive, Path metadata) {
        return List.of(
            "--data-only",
            "--table=gtd.database_identity",
            "--no-owner",
            "--no-acl",
            "--no-password",
            "--file=" + metadata,
            archive.toString());
    }

    private void requireKnownArchiveIdentity(Path metadata) throws IOException {
        String content = Files.readString(metadata);
        boolean production = content.contains("PRODUCTION");
        boolean staging = content.contains("STAGING");
        if (production == staging) {
            throw new IllegalArgumentException("backup archive value '%s' is invalid; expected exactly one PRODUCTION or STAGING database identity".formatted(metadata));
        }
    }
}
