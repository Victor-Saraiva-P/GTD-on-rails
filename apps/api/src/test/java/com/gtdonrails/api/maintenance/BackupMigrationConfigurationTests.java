package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.RcloneDataSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupMigrationConfigurationTests {

    @TempDir
    private Path tempDirectory;

    @Test
    void pendingMigrationRunsOnlyAfterSuccessfulFreshBackup() {
        List<String> events = new ArrayList<>();
        RecordingCommandRunner recordingCommandRunner = new RecordingCommandRunner(events, false);
        RecordingSchemaMigration schemaMigration = RecordingSchemaMigration.pending(events);

        migrationGate(recordingCommandRunner).migrate(schemaMigration);

        assertTrue(events.indexOf("pg_restore") < events.indexOf("flyway"));
        assertTrue(backupNames().stream().anyMatch(name -> name.endsWith("-pre-migration.dump")));
    }

    @Test
    void backupFailureBlocksPendingMigrationAndStartup() {
        List<String> events = new ArrayList<>();
        RecordingCommandRunner recordingCommandRunner = new RecordingCommandRunner(events, true);
        RecordingSchemaMigration schemaMigration = RecordingSchemaMigration.pending(events);
        BackupMigrationGate migrationGate = migrationGate(recordingCommandRunner);

        IllegalStateException failure = assertThrows(
            IllegalStateException.class, () -> migrationGate.migrate(schemaMigration));

        assertTrue(failure.getMessage().contains("pg_dump failed"));
        assertFalse(schemaMigration.migrated);
    }

    @Test
    void currentSchemaMigratesWithoutCreatingABackup() {
        RecordingSchemaMigration schemaMigration = RecordingSchemaMigration.current();

        migrationGate(new RecordingCommandRunner(new ArrayList<>(), false)).migrate(schemaMigration);

        assertTrue(schemaMigration.migrated);
        assertTrue(backupNames().isEmpty());
    }

    private BackupMigrationGate migrationGate(RecordingCommandRunner recordingCommandRunner) {
        PostgresBackupService backupService = new PostgresBackupService(
            backupDirectory(), new BackupWorkDirectory(workDirectory()),
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            new NoOpFileSyncService(), Clock.fixed(Instant.parse("2026-08-11T02:00:00Z"), ZoneOffset.UTC), recordingCommandRunner);
        return new BackupMigrationGate(backupService);
    }

    private List<String> backupNames() {
        if (!Files.isDirectory(backupDirectory())) return List.of();
        try (Stream<Path> paths = Files.list(backupDirectory())) {
            return paths.map(path -> path.getFileName().toString()).toList();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("backup directory value '%s' is invalid; expected readable test directory".formatted(backupDirectory()), exception);
        }
    }

    private Path backupDirectory() {
        return tempDirectory.resolve("backups");
    }

    private Path workDirectory() {
        return tempDirectory.resolve("work");
    }

    private static class RecordingCommandRunner implements PostgresCommandRunner {

        private final List<String> events;
        private final boolean failDump;

        private RecordingCommandRunner(List<String> events, boolean failDump) {
            this.events = events;
            this.failDump = failDump;
        }

        @Override
        public void run(String executable, List<String> arguments, Map<String, String> environment) {
            events.add(executable);
            if (failDump && "pg_dump".equals(executable)) throw new IllegalStateException("pg_dump failed");
            if ("pg_dump".equals(executable)) writeArchive(arguments);
        }

        private void writeArchive(List<String> arguments) {
            String output = arguments.stream().filter(value -> value.startsWith("--file=")).findFirst().orElseThrow();
            try {
                Files.writeString(Path.of(output.substring(7)), "closed archive");
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("archive value '%s' is invalid; expected writable fake output".formatted(output), exception);
            }
        }
    }

    private static class RecordingSchemaMigration implements SchemaMigration {

        private final boolean pending;
        private final List<String> events;
        private boolean migrated;

        private RecordingSchemaMigration(boolean pending, List<String> events) {
            this.pending = pending;
            this.events = events;
        }

        private static RecordingSchemaMigration pending(List<String> events) {
            return new RecordingSchemaMigration(true, events);
        }

        private static RecordingSchemaMigration current() {
            return new RecordingSchemaMigration(false, new ArrayList<>());
        }

        @Override
        public boolean hasPendingMigrations() {
            return pending;
        }

        @Override
        public void migrate() {
            migrated = true;
            events.add("flyway");
        }
    }

    private static class NoOpFileSyncService extends FileSyncService {

        private NoOpFileSyncService() {
            super(new DataSyncService(new DataSyncProperties(), new RcloneDataSyncService(new DataSyncProperties()), "."));
        }

        @Override
        public void requestSync(String reason) {
            // The Flyway seam ends after a closed archive; File Sync is covered by backup service tests.
        }
    }
}
