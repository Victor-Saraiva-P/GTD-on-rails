package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PostgresBackupServiceTests {

    private static final Instant NOW = Instant.parse("2026-08-11T02:00:00Z");

    @TempDir
    private Path tempDirectory;

    @Test
    void closesArchiveBeforeRequestingFileSyncWithoutExposingPassword() throws Exception {
        FakeCommandRunner commands = new FakeCommandRunner();
        FakeFileSyncService fileSync = new FakeFileSyncService();
        PostgresBackupService service = service(commands, fileSync);

        BackupResult result = service.createManualBackup();

        assertTrue(Files.isRegularFile(result.path()));
        assertTrue(Files.size(result.path()) > 0);
        assertTrue(commands.arguments.stream().noneMatch(argument -> argument.contains("secret")));
        assertTrue(commands.passfileContent.contains("secret"));
        assertTrue(commands.outputPath.startsWith(workDirectory()));
        assertTrue(commands.passfilePath.startsWith(workDirectory()));
        assertTrue(fileSync.reasons.contains("PostgreSQL backup created"));
        assertFalse(Files.list(tempDirectory).anyMatch(path -> path.toString().endsWith(".partial")));
        assertFalse(Files.list(tempDirectory).anyMatch(path -> path.getFileName().toString().startsWith(".gtd-pgpass-")));
    }

    @Test
    void failedDumpRemovesPartialArchiveAndDoesNotRequestFileSync() throws Exception {
        FakeCommandRunner commands = new FakeCommandRunner();
        commands.failDump = true;
        FakeFileSyncService fileSync = new FakeFileSyncService();
        PostgresBackupService service = service(commands, fileSync);

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, service::createManualBackup);

        assertFalse(Files.list(tempDirectory).anyMatch(path -> path.getFileName().toString().endsWith(".dump")));
        assertFalse(Files.list(tempDirectory).anyMatch(path -> path.getFileName().toString().endsWith(".partial")));
        assertTrue(fileSync.reasons.isEmpty());
    }

    @Test
    void failedFileSyncRequestRemovesPublishedArchive() throws Exception {
        FakeCommandRunner commands = new FakeCommandRunner();
        FakeFileSyncService fileSync = new FakeFileSyncService();
        fileSync.failRequest = true;
        PostgresBackupService service = service(commands, fileSync);

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, service::createManualBackup);

        assertFalse(Files.list(backupDirectory()).anyMatch(path -> path.toString().endsWith(".dump")));
    }

    private PostgresBackupService service(FakeCommandRunner commands, FakeFileSyncService fileSync) {
        return new PostgresBackupService(
            backupDirectory(),
            workDirectory(),
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            fileSync,
            Clock.fixed(NOW, ZoneOffset.UTC),
            commands);
    }

    private Path backupDirectory() {
        return tempDirectory.resolve("synchronized-backups");
    }

    private Path workDirectory() {
        return tempDirectory.resolve("local-backup-work");
    }

    private static class FakeCommandRunner implements PostgresCommandRunner {

        private final List<String> arguments = new ArrayList<>();
        private String passfileContent = "";
        private Path passfilePath = Path.of(".");
        private Path outputPath = Path.of(".");
        private boolean failDump;

        @Override
        public void run(String executable, List<String> commandArguments, Map<String, String> environment) {
            arguments.addAll(commandArguments);
            try {
                passfilePath = Path.of(environment.get("PGPASSFILE"));
                passfileContent = Files.readString(passfilePath);
                if ("pg_dump".equals(executable) && failDump) throw new IllegalStateException("dump failed");
                if ("pg_dump".equals(executable)) {
                    outputPath = outputPath(commandArguments);
                    Files.writeString(outputPath, "closed archive");
                }
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("fake PostgreSQL process value is invalid; expected readable passfile", exception);
            }
        }

        private Path outputPath(List<String> commandArguments) {
            return Path.of(commandArguments.stream().filter(argument -> argument.startsWith("--file=")).findFirst().orElseThrow().substring(7));
        }
    }

    private static class FakeFileSyncService extends FileSyncService {

        private final List<String> reasons = new ArrayList<>();
        private boolean failRequest;

        private FakeFileSyncService() {
            super(new DataSyncService(new DataSyncProperties(), new RcloneDataSyncService(new DataSyncProperties()), "."));
        }

        @Override
        public void requestSync(String reason) {
            if (failRequest) throw new IllegalStateException("file sync request failed");
            reasons.add(reason);
        }

    }
}
