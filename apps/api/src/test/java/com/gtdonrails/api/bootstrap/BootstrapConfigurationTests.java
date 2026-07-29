package com.gtdonrails.api.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.RcloneDataSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.Tag;

@Tag("unit")
class BootstrapConfigurationTests {

    @TempDir
    private Path tempDir;

    @Test
    void reportsMissingConfigurationWithoutStartingNormalRuntime() throws Exception {
        BootstrapConfiguration configuration = configuration();

        int exitCode = configuration.run(new FakeDataSyncService(tempDir));

        assertEquals(2, exitCode);
        assertEquals("MISSING", status().get("configurationStatus").asText());
    }

    @Test
    void acceptsOnlyPostgresqlConfigurationWithCredentials() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), """
            spring.datasource.url=jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full
            spring.datasource.username=gtd_app
            spring.datasource.password=secret
            """);
        BootstrapConfiguration configuration = configuration();

        int exitCode = configuration.run(new FakeDataSyncService(tempDir));

        assertEquals(0, exitCode);
        assertEquals("READY", status().get("configurationStatus").asText());
    }

    @Test
    void rejectsConfigurationWithoutPostgresqlCredentials() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"),
            "spring.datasource.url=jdbc:sqlite:legacy.db\n");

        BootstrapConfiguration configuration = configuration();
        int exitCode = configuration.run(new FakeDataSyncService(tempDir));

        assertEquals(2, exitCode);
        assertEquals("INVALID", status().get("configurationStatus").asText());
        assertEquals(true, configuration.repairRequired());
    }

    @Test
    void rejectsMalformedPostgresqlTargetAsExistingConfiguration() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), """
            spring.datasource.url=jdbc:postgresql://
            spring.datasource.username=gtd_app
            spring.datasource.password=secret
            """);

        BootstrapConfiguration configuration = configuration();
        int exitCode = configuration.run(new FakeDataSyncService(tempDir));

        assertEquals(2, exitCode);
        assertEquals("INVALID", configuration.configurationStatus());
        assertEquals(true, configuration.repairRequired());
    }

    @Test
    void rejectsExistingConfigurationWithoutFullTlsVerification() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), """
            spring.datasource.url=jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
            spring.datasource.username=gtd_app
            spring.datasource.password=secret
            """);

        assertEquals(2, configuration().run(new FakeDataSyncService(tempDir)));
        assertEquals("INVALID", status().get("configurationStatus").asText());
    }

    @Test
    void invalidConfigurationIsRepairableButNeverSetup() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), "spring.datasource.url=broken\n");
        BootstrapConfiguration configuration = configuration();
        configuration.run(new FakeDataSyncService(tempDir));

        assertEquals(false, configuration.setupRequired());
        assertEquals(true, configuration.repairRequired());
    }

    @Test
    void repairFailureKeepsBootstrapAvailable() {
        BootstrapConfiguration configuration = configuration();
        configuration.run(new FakeDataSyncService(tempDir));
        configuration.markRepairFailed();

        assertEquals("REPAIR_FAILED", configuration.configurationStatus());
        assertEquals(true, configuration.repairRequired());
    }

    @Test
    void reportsSyncFailureWithoutTreatingItAsFirstInstallation() throws Exception {
        int exitCode = configuration().run(new FailingDataSyncService(tempDir));

        assertEquals(1, exitCode);
        assertEquals("FAILED", status().get("configurationStatus").asText());
    }

    @Test
    void resetModeValidatesConfigurationWithoutPullingBeforeIdentityCheck() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), """
            spring.datasource.url=jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full
            spring.datasource.username=gtd_app
            spring.datasource.password=secret
            """);
        CountingDataSyncService sync = new CountingDataSyncService(tempDir);

        assertEquals(0, resetConfiguration().run(sync));
        assertEquals(0, sync.startupCalls);
    }

    private BootstrapConfiguration configuration() {
        return configuration(false);
    }

    private BootstrapConfiguration resetConfiguration() {
        return configuration(true);
    }

    private BootstrapConfiguration configuration(boolean stagingReset) {
        return new BootstrapConfiguration(
            new ObjectMapper(),
            tempDir.toString(),
            tempDir.resolve("bootstrap-status.json").toString(),
            stagingReset);
    }

    private JsonNode status() throws Exception {
        return new ObjectMapper().readTree(Files.readString(tempDir.resolve("bootstrap-status.json")));
    }

    private static class FakeDataSyncService extends DataSyncService {

        protected FakeDataSyncService(Path dataRoot) {
            super(new DataSyncProperties(), new RcloneDataSyncService(new DataSyncProperties()), dataRoot.toString());
        }

        @Override
        public void syncOnStartup() {
        }
    }

    private static class FailingDataSyncService extends FakeDataSyncService {

        private FailingDataSyncService(Path dataRoot) {
            super(dataRoot);
        }

        @Override
        public void syncOnStartup() {
            throw new IllegalStateException("file sync failed");
        }
    }

    private static class CountingDataSyncService extends FakeDataSyncService {

        private int startupCalls;

        private CountingDataSyncService(Path dataRoot) {
            super(dataRoot);
        }

        @Override
        public void syncOnStartup() {
            startupCalls++;
        }
    }
}
