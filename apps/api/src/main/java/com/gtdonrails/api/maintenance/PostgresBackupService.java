package com.gtdonrails.api.maintenance;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.gtdonrails.api.services.FileSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PostgresBackupService implements DailyBackupCreator {

    private static final String BACKUP_PREFIX = "gtd-backup-";
    private static final String BACKUP_SUFFIX = ".dump";
    private static final int RETENTION_DAYS = 30;
    private static final Logger logger = LoggerFactory.getLogger(PostgresBackupService.class);

    private final Path backupDirectory;
    private final BackupWorkDirectory workDirectory;
    private final PostgresConnection connection;
    private final FileSyncService fileSyncService;
    private final Clock clock;
    private final PostgresCommandRunner commandRunner;

    @Autowired
    public PostgresBackupService(
        @Value("${gtd.backup.directory:${gtd.data.root-directory}/backups}") String backupDirectory,
        @Value("${gtd.backup.work-directory:${user.home}/.cache/gtd-on-rails/backup-work}") String workDirectory,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${spring.datasource.url:}") String jdbcUrl,
        @Value("${spring.datasource.username:}") String username,
        @Value("${spring.datasource.password:}") String password,
        FileSyncService fileSyncService,
        Clock clock,
        PostgresCommandRunner commandRunner
    ) {
        this(Path.of(backupDirectory), BackupWorkDirectory.outsideDataRoot(dataRoot, workDirectory), PostgresConnection.ofNullable(jdbcUrl, username, password), fileSyncService, clock, commandRunner);
    }

    PostgresBackupService(
        Path backupDirectory,
        BackupWorkDirectory workDirectory,
        PostgresConnection connection,
        FileSyncService fileSyncService,
        Clock clock,
        PostgresCommandRunner commandRunner
    ) {
        this.backupDirectory = backupDirectory.toAbsolutePath().normalize();
        this.workDirectory = workDirectory;
        this.connection = connection;
        this.fileSyncService = fileSyncService;
        this.clock = clock;
        this.commandRunner = commandRunner;
    }

    /** Creates, validates, closes, and publishes one logical gtd archive.
     *
     * <p>Example: {@code backupService.createManualBackup()}.</p>
     */
    public BackupResult createManualBackup() {
        return createBackup("manual");
    }

    /** Creates a recovery point immediately before Flyway changes the schema.
     *
     * <p>Example: {@code backupService.createPreMigrationBackup()}.</p>
     */
    public BackupResult createPreMigrationBackup() {
        return createBackup("pre-migration");
    }

    /** Creates the daily archive only when the current local day has no archive.
     *
     * <p>Example: {@code backupService.createDailyBackupIfMissing()}.</p>
     */
    @Override
    public synchronized void createDailyBackupIfMissing() {
        try {
            if (!hasBackupForToday()) createBackup("daily");
        } catch (IOException exception) {
            logFailure("postgres_backup_lookup_failed", "Daily PostgreSQL backup lookup failed", exception);
        } catch (RuntimeException exception) {
            // A scheduled failure must remain observable without stopping future maintenance runs.
            logFailure("postgres_backup_failed", "Daily PostgreSQL backup failed", exception);
        }
    }

    private BackupResult createBackup(String reason) {
        Path temporaryArchive = null;
        Path publishedArchive = null;
        try {
            temporaryArchive = createTemporaryArchive();
            validateTemporaryArchive(temporaryArchive);
            long archiveSize = Files.size(temporaryArchive);
            publishedArchive = closeArchive(temporaryArchive, archiveName(reason));
            return publishBackup(publishedArchive, archiveSize);
        } catch (IOException exception) {
            deleteFailedArtifacts(temporaryArchive, publishedArchive);
            throw backupFailure(exception);
        } catch (RuntimeException exception) {
            deleteFailedArtifacts(temporaryArchive, publishedArchive);
            throw exception;
        }
    }

    private BackupResult publishBackup(Path archive, long archiveSize) {
        requestFileSyncSafely();
        removeExpiredBackupsSafely();
        return new BackupResult(archive.getFileName().toString(), archiveSize, archive);
    }

    private void requestFileSyncSafely() {
        try {
            fileSyncService.requestSync("PostgreSQL backup created");
        } catch (RuntimeException exception) {
            logFailure("postgres_backup_sync_request_failed", "PostgreSQL backup File Sync request failed", exception);
        }
    }

    private Path createTemporaryArchive() throws IOException {
        return workDirectory.createBackupFile(backupDirectory, ".gtd-backup-", ".partial");
    }

    private void validateTemporaryArchive(Path temporaryArchive) throws IOException {
        try (PostgresCommandEnvironment environment = PostgresCommandEnvironment.open(connection, workDirectory.path())) {
            commandRunner.run("pg_dump", connection.dumpArguments(temporaryArchive), environment.environment());
            requireClosedArchive(temporaryArchive);
            commandRunner.run("pg_restore", validationArguments(temporaryArchive), environment.environment());
        }
    }

    private List<String> validationArguments(Path archive) {
        return List.of("--list", "--no-password", archive.toString());
    }

    private IllegalStateException backupFailure(IOException exception) {
        return new IllegalStateException(
            "PostgreSQL backup directory value '%s' is invalid; expected completed archive: %s"
                .formatted(backupDirectory, exception.getMessage()), exception);
    }

    private void requireClosedArchive(Path archive) throws IOException {
        if (!Files.isRegularFile(archive) || Files.size(archive) == 0) {
            throw new IOException("archive value '%s' is invalid; expected non-empty pg_dump output".formatted(archive));
        }
    }

    private Path closeArchive(Path temporaryArchive, String fileName) throws IOException {
        Path archive = backupDirectory.resolve(fileName);
        Files.move(temporaryArchive, archive, StandardCopyOption.ATOMIC_MOVE);
        return archive;
    }

    private String archiveName(String reason) {
        String timestamp = clock.instant().toString().replace(":", "-");
        return BACKUP_PREFIX + timestamp + "-" + reason + BACKUP_SUFFIX;
    }

    private boolean hasBackupForToday() throws IOException {
        Files.createDirectories(backupDirectory);
        LocalDate today = LocalDate.now(clock);
        try (DirectoryStream<Path> files = Files.newDirectoryStream(backupDirectory, this::isDailyArchive)) {
            for (Path file : files) {
                LocalDate fileDate = archiveDate(file);
                if (today.equals(fileDate)) return true;
            }
        }
        return false;
    }

    private LocalDate archiveDate(Path file) {
        String date = file.getFileName().toString().substring(BACKUP_PREFIX.length(), BACKUP_PREFIX.length() + 10);
        return LocalDate.parse(date);
    }

    private void removeExpiredBackups() throws IOException {
        List<Path> archives = new ArrayList<>();
        try (DirectoryStream<Path> files = Files.newDirectoryStream(backupDirectory, this::isDailyArchive)) {
            files.forEach(archives::add);
        }
        archives.sort(Comparator.comparing(this::archiveDate).thenComparing(this::archiveFileName).reversed());
        int firstExpired = Math.min(RETENTION_DAYS, archives.size());
        for (Path archive : archives.subList(firstExpired, archives.size())) Files.deleteIfExists(archive);
    }

    private void removeExpiredBackupsSafely() {
        try {
            removeExpiredBackups();
        } catch (IOException exception) {
            logFailure("postgres_backup_retention_failed", "PostgreSQL backup retention failed", exception);
        }
    }

    private boolean isArchive(Path path) {
        String name = path.getFileName().toString();
        return Files.isRegularFile(path) && name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX);
    }

    private boolean isDailyArchive(Path path) {
        if (!isArchive(path) || !path.getFileName().toString().endsWith("-daily" + BACKUP_SUFFIX)) return false;
        try {
            archiveDate(path);
            return true;
        } catch (DateTimeParseException | IndexOutOfBoundsException exception) {
            return false;
        }
    }

    private String archiveFileName(Path archive) {
        return archive.getFileName().toString();
    }

    private void deleteFailedArtifacts(Path temporaryArchive, Path publishedArchive) {
        deleteArtifact(temporaryArchive);
        deleteArtifact(publishedArchive);
    }

    private void deleteArtifact(Path archive) {
        if (archive == null) return;
        try {
            Files.deleteIfExists(archive);
        } catch (IOException ignored) {
            // The original failure is more actionable than cleanup noise.
        }
    }

    private void logFailure(String event, String message, Exception exception) {
        logger.atError()
            .addKeyValue("event", event)
            .addKeyValue("error_message", exception.getMessage())
            .setCause(exception)
            .log(message);
    }
}
