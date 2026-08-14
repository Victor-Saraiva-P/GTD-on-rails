package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.RcloneDataSyncService;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;

class BackupMigrationConfigurationTests {

    @TempDir
    private Path tempDirectory;

    @Test
    void pendingMigrationRunsOnlyAfterSuccessfulFreshBackup() {
        List<String> events = new ArrayList<>();
        RecordingCommandRunner commands = new RecordingCommandRunner(events, false);
        Flyway flyway = flywayWithPendingMigration(events);

        strategy(commands).migrate(flyway);

        assertTrue(events.indexOf("pg_restore") < events.indexOf("flyway"));
        assertTrue(backupNames().stream().anyMatch(name -> name.endsWith("-pre-migration.dump")));
    }

    @Test
    void backupFailureBlocksPendingMigrationAndStartup() {
        List<String> events = new ArrayList<>();
        RecordingCommandRunner commands = new RecordingCommandRunner(events, true);
        Flyway flyway = flywayWithPendingMigration(events);

        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> strategy(commands).migrate(flyway));

        assertTrue(failure.getMessage().contains("pg_dump failed"));
        verify(flyway, never()).migrate();
    }

    @Test
    void currentSchemaMigratesWithoutCreatingABackup() {
        Flyway flyway = flywayWithoutPendingMigration();

        strategy(new RecordingCommandRunner(new ArrayList<>(), false)).migrate(flyway);

        verify(flyway).migrate();
        assertTrue(backupNames().isEmpty());
    }

    private FlywayMigrationStrategy strategy(RecordingCommandRunner commands) {
        PostgresBackupService backupService = new PostgresBackupService(
            backupDirectory(), new BackupWorkDirectory(workDirectory()),
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            new NoOpFileSyncService(), Clock.fixed(Instant.parse("2026-08-11T02:00:00Z"), ZoneOffset.UTC), commands);
        return new BackupMigrationConfiguration().backupBeforeFlyway(backupService);
    }

    private Flyway flywayWithPendingMigration(List<String> events) {
        Flyway flyway = flywayWithPendingCount(1);
        when(flyway.migrate()).thenAnswer(invocation -> {
            events.add("flyway");
            return null;
        });
        return flyway;
    }

    private Flyway flywayWithoutPendingMigration() {
        return flywayWithPendingCount(0);
    }

    private Flyway flywayWithPendingCount(int count) {
        Flyway flyway = mock(Flyway.class);
        MigrationInfoService migrationInfo = mock(MigrationInfoService.class);
        when(flyway.info()).thenReturn(migrationInfo);
        when(migrationInfo.pending()).thenReturn(new MigrationInfo[count]);
        return flyway;
    }

    private List<String> backupNames() {
        if (!Files.isDirectory(backupDirectory())) return List.of();
        try (var paths = Files.list(backupDirectory())) {
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
