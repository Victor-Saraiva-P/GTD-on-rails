package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import java.util.stream.Stream;

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
    void failedFileSyncRequestKeepsCompletedArchiveSuccessful() throws Exception {
        FakeCommandRunner commands = new FakeCommandRunner();
        FakeFileSyncService fileSync = new FakeFileSyncService();
        fileSync.failRequest = true;
        PostgresBackupService service = service(commands, fileSync);

        BackupResult result = service.createManualBackup();

        assertTrue(Files.isRegularFile(result.path()));
    }

    @Test
    void dailyBackupCreatesAtMostOneArchiveForTheCurrentDay() throws Exception {
        FakeCommandRunner commands = new FakeCommandRunner();
        PostgresBackupService service = service(commands, new FakeFileSyncService());

        service.createDailyBackupIfMissing();
        service.createDailyBackupIfMissing();

        assertEquals(1, dailyArchives().size());
        assertEquals(2, commands.executables.size());
    }

    @Test
    void dailyBackupRetainsTheNewestThirtyArchiveDates() throws Exception {
        createDailyArchives(30);
        PostgresBackupService service = service(new FakeCommandRunner(), new FakeFileSyncService());

        service.createDailyBackupIfMissing();

        List<String> names = dailyArchives().stream().map(path -> path.getFileName().toString()).toList();
        assertEquals(30, names.size());
        assertFalse(names.contains("gtd-backup-2026-07-12T02-00-00Z-daily.dump"));
        assertTrue(names.contains("gtd-backup-2026-08-11T02-00-00Z-daily.dump"));
    }

    @Test
    void overlappingDailyBackupRequestsCreateOneArchive() throws Exception {
        BlockingCommandRunner commands = new BlockingCommandRunner();
        PostgresBackupService service = service(commands, new FakeFileSyncService());
        try (ExecutorService requests = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<?> first = requests.submit(service::createDailyBackupIfMissing);
            commands.awaitDumpStart();
            Future<?> second = requests.submit(service::createDailyBackupIfMissing);
            commands.releaseDump();
            first.get();
            second.get();
        }
        assertEquals(1, dailyArchives().size());
        assertEquals(2, commands.executables.size());
    }

    @Test
    void malformedDailyArchiveNameDoesNotBlockTodaysBackup() throws Exception {
        Files.createDirectories(backupDirectory());
        Files.writeString(backupDirectory().resolve("gtd-backup-invalid-daily.dump"), "stray archive");

        service(new FakeCommandRunner(), new FakeFileSyncService()).createDailyBackupIfMissing();

        assertTrue(dailyArchives().stream().anyMatch(path -> path.getFileName().toString().startsWith("gtd-backup-2026-08-11")));
    }

    @Test
    void retentionBreaksSameDateTiesByArchiveName() throws Exception {
        createDailyArchives(29);
        writeNamedArchive("gtd-backup-2026-07-13T01-00-00Z-daily.dump");
        writeNamedArchive("gtd-backup-2026-07-13T03-00-00Z-daily.dump");

        service(new FakeCommandRunner(), new FakeFileSyncService()).createDailyBackupIfMissing();

        List<String> names = dailyArchives().stream().map(path -> path.getFileName().toString()).toList();
        assertEquals(30, names.size());
        assertTrue(names.contains("gtd-backup-2026-07-13T03-00-00Z-daily.dump"));
        assertFalse(names.contains("gtd-backup-2026-07-13T02-00-00Z-daily.dump"));
    }

    private void writeNamedArchive(String name) throws Exception {
        Files.writeString(backupDirectory().resolve(name), "archive");
    }

    private void createDailyArchives(int count) throws Exception {
        Files.createDirectories(backupDirectory());
        IntStream.rangeClosed(1, count).forEach(this::createDailyArchive);
    }

    private void createDailyArchive(int daysAgo) {
        String timestamp = NOW.minusSeconds(daysAgo * 86_400L).toString().replace(":", "-");
        try {
            Files.writeString(backupDirectory().resolve("gtd-backup-" + timestamp + "-daily.dump"), "archive");
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("daily archive value '%s' is invalid; expected writable test archive".formatted(timestamp), exception);
        }
    }

    private List<Path> dailyArchives() throws Exception {
        try (Stream<Path> paths = Files.list(backupDirectory())) {
            return paths.filter(path -> path.getFileName().toString().endsWith("-daily.dump")).sorted().toList();
        }
    }

    private PostgresBackupService service(FakeCommandRunner commands, FakeFileSyncService fileSync) {
        return new PostgresBackupService(
            backupDirectory(),
            new BackupWorkDirectory(workDirectory()),
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
        protected final List<String> executables = new ArrayList<>();
        private String passfileContent = "";
        private Path passfilePath = Path.of(".");
        private Path outputPath = Path.of(".");
        private boolean failDump;

        @Override
        public void run(String executable, List<String> commandArguments, Map<String, String> environment) {
            executables.add(executable);
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

    private static class BlockingCommandRunner extends FakeCommandRunner {

        private final CountDownLatch dumpStarted = new CountDownLatch(1);
        private final CountDownLatch releaseDump = new CountDownLatch(1);

        @Override
        public void run(String executable, List<String> arguments, Map<String, String> environment) {
            if ("pg_dump".equals(executable)) awaitRelease();
            super.run(executable, arguments, environment);
        }

        private void awaitRelease() {
            dumpStarted.countDown();
            try {
                releaseDump.await();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("backup process was interrupted; expected released fake process", exception);
            }
        }

        private void awaitDumpStart() throws InterruptedException {
            dumpStarted.await();
        }

        private void releaseDump() {
            releaseDump.countDown();
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
