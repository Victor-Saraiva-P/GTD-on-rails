package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DatabaseIdentityService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StagingBackupRestoreServiceTests {

    @TempDir
    private Path tempDirectory;

    @Test
    void validatesProductionArchiveInStagingWithoutRestoringItsProductionIdentity() throws Exception {
        Path archive = tempDirectory.resolve("gtd-backup-production.dump");
        Files.writeString(archive, "archive");
        FakeCommandRunner commands = new FakeCommandRunner();
        FakeDatabaseIdentityService identity = new FakeDatabaseIdentityService();
        Path workDirectory = tempDirectory.resolve("local-restore-work");
        StagingBackupRestoreService service = new StagingBackupRestoreService(
            tempDirectory,
            workDirectory,
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            identity,
            commands);

        RestoreResult result = service.restore(archive.getFileName().toString());

        assertEquals("STAGING", result.environment());
        assertEquals(List.of("STAGING", "STAGING"), identity.expectedIdentities);
        assertTrue(commands.arguments.stream().anyMatch(argument -> argument.equals("--exclude-table=gtd.database_identity")));
        assertTrue(commands.arguments.stream().noneMatch(argument -> argument.contains("secret")));
        assertTrue(commands.passfilePath.startsWith(workDirectory));
        assertTrue(commands.metadataPath.startsWith(workDirectory));
        assertTrue(Files.exists(archive));
    }

    @Test
    void rejectsPathTraversalBeforeInvokingRestore() {
        FakeCommandRunner commands = new FakeCommandRunner();
        StagingBackupRestoreService service = new StagingBackupRestoreService(
            tempDirectory,
            tempDirectory.resolve("local-restore-work"),
            new PostgresConnection("jdbc:postgresql://127.0.0.1:5432/gtd", "gtd_app", "secret"),
            new FakeDatabaseIdentityService(),
            commands);

        assertThrows(IllegalArgumentException.class, () -> service.restore("../production.dump"));
        assertTrue(commands.arguments.isEmpty());
    }

    private static class FakeCommandRunner implements PostgresCommandRunner {

        private final List<String> arguments = new ArrayList<>();
        private Path passfilePath = Path.of(".");
        private Path metadataPath = Path.of(".");

        @Override
        public void run(String executable, List<String> commandArguments, Map<String, String> environment) {
            arguments.addAll(commandArguments);
            passfilePath = Path.of(environment.get("PGPASSFILE"));
            String metadata = commandArguments.stream().filter(argument -> argument.startsWith("--file=")).findFirst().orElse(null);
            if (metadata != null) {
                try {
                    metadataPath = Path.of(metadata.substring(7));
                    Files.writeString(metadataPath, "INSERT INTO gtd.database_identity VALUES ('PRODUCTION');");
                } catch (java.io.IOException exception) {
                    throw new IllegalStateException("fake restore output value is invalid; expected writable metadata file", exception);
                }
            }
        }
    }

    private static class FakeDatabaseIdentityService extends DatabaseIdentityService {

        private final List<String> expectedIdentities = new ArrayList<>();

        private FakeDatabaseIdentityService() {
            super(new org.springframework.jdbc.core.JdbcTemplate());
        }

        @Override
        public void require(String expectedIdentity) {
            expectedIdentities.add(expectedIdentity);
        }
    }
}
