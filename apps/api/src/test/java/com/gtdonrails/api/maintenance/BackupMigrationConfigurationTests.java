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
import java.util.stream.Stream;

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
        RecordingCommandRunner recordingCommandRunner = new RecordingCommandRunner(events, false);
        FakeFlywayScenario flywayScenario = FakeFlywayScenario.withPendingMigration(events);

        strategy(recordingCommandRunner).migrate(flywayScenario.flyway());

        assertTrue(events.indexOf("pg_restore") < events.indexOf("flyway"));
        assertTrue(backupNames().stream().anyMatch(name -> name.endsWith("-pre-migration.dump")));
    }

    @Test
    void backupFailureBlocksPendingMigrationAndStartup() {
        List<String> events = new ArrayList<>();
        RecordingCommandRunner recordingCommandRunner = new RecordingCommandRunner(events, true);
        FakeFlywayScenario flywayScenario = FakeFlywayScenario.withPendingMigration(events);

        IllegalStateException failure = assertThrows(
            IllegalStateException.class, () -> strategy(recordingCommandRunner).migrate(flywayScenario.flyway()));

        assertTrue(failure.getMessage().contains("pg_dump failed"));
        flywayScenario.verifyMigrationSkipped();
    }

    @Test
    void currentSchemaMigratesWithoutCreatingABackup() {
        FakeFlywayScenario flywayScenario = FakeFlywayScenario.withCurrentSchema();

        strategy(new RecordingCommandRunner(new ArrayList<>(), false)).migrate(flywayScenario.flyway());

        flywayScenario.verifyMigrationCompleted();
        assertTrue(backupNames().isEmpty());
    }

    private FlywayMigrationStrategy strategy(RecordingCommandRunner recordingCommandRunner) {
        PostgresBackupService backupService = new PostgresBackupService(
            backupDirectory(), new BackupWorkDirectory(workDirectory()),
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            new NoOpFileSyncService(), Clock.fixed(Instant.parse("2026-08-11T02:00:00Z"), ZoneOffset.UTC), recordingCommandRunner);
        return new BackupMigrationConfiguration().backupBeforeFlyway(backupService);
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

    private static class FakeFlywayScenario {

        private final Flyway flyway;

        private FakeFlywayScenario(int pendingCount, List<String> events) {
            flyway = mock(Flyway.class);
            MigrationInfoService migrationInfo = mock(MigrationInfoService.class);
            when(flyway.info()).thenReturn(migrationInfo);
            when(migrationInfo.pending()).thenReturn(new MigrationInfo[pendingCount]);
            when(flyway.migrate()).thenAnswer(invocation -> {
                events.add("flyway");
                return null;
            });
        }

        private static FakeFlywayScenario withPendingMigration(List<String> events) {
            return new FakeFlywayScenario(1, events);
        }

        private static FakeFlywayScenario withCurrentSchema() {
            return new FakeFlywayScenario(0, new ArrayList<>());
        }

        private Flyway flyway() {
            return flyway;
        }

        private void verifyMigrationSkipped() {
            verify(flyway, never()).migrate();
        }

        private void verifyMigrationCompleted() {
            verify(flyway).migrate();
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
