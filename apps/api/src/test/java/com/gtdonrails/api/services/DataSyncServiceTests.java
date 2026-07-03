package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.dtos.sync.DataSyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class DataSyncServiceTests {

    @TempDir
    private Path tempDir;

    private DataSyncService service;

    @AfterEach
    void tearDown() {
        if (service != null) service.shutdown();
    }

    @Test
    void staysDisabledWhenRcloneIsDisabled() throws Exception {
        FakeRcloneDataSyncService rcloneDataSyncService = new FakeRcloneDataSyncService();
        service = new DataSyncService(properties(), rcloneDataSyncService, tempDir.toString());

        rcloneDataSyncService.enabled = false;

        service.syncOnStartup();

        assertEquals(DataSyncState.DISABLED, service.status().state());
    }

    @Test
    void bootstrapsFromRemoteWhenBaselineMarkerIsMissing() throws Exception {
        FakeRcloneDataSyncService rcloneDataSyncService = new FakeRcloneDataSyncService();
        service = new DataSyncService(properties(), rcloneDataSyncService, tempDir.toString());

        rcloneDataSyncService.enabled = true;

        service.syncOnStartup();

        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneDataSyncService.bootstrapBisyncDirectory);
        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneDataSyncService.bisyncDirectory);
        assertEquals(DataSyncState.SYNCED, service.status().state());
        assertTrue(Files.exists(baselineMarker()));
    }

    @Test
    void runsNormalBisyncWhenBaselineMarkerExists() throws Exception {
        Files.createDirectories(baselineMarker().getParent());
        Files.writeString(baselineMarker(), "ready");
        FakeRcloneDataSyncService rcloneDataSyncService = new FakeRcloneDataSyncService();
        service = new DataSyncService(properties(), rcloneDataSyncService, tempDir.toString());

        rcloneDataSyncService.enabled = true;

        service.syncOnStartup();

        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneDataSyncService.bisyncDirectory);
        assertEquals(null, rcloneDataSyncService.bootstrapBisyncDirectory);
        assertEquals(DataSyncState.SYNCED, service.status().state());
    }

    private DataSyncProperties properties() {
        DataSyncProperties properties = new DataSyncProperties();
        properties.setStateDirectory("sync-state");
        properties.setBaselineMarker("bootstrap-completed");
        return properties;
    }

    private Path baselineMarker() {
        return tempDir.resolve("sync-state/bootstrap-completed");
    }

    private static class FakeRcloneDataSyncService extends RcloneDataSyncService {

        private boolean enabled;
        private Path bisyncDirectory;
        private Path bootstrapBisyncDirectory;

        private FakeRcloneDataSyncService() {
            super(new DataSyncProperties());
        }

        @Override
        public boolean isEnabled() {
            return enabled;
        }

        @Override
        public void bisync(Path dataRoot) {
            bisyncDirectory = dataRoot;
        }

        @Override
        public void bootstrapBisync(Path dataRoot) {
            bootstrapBisyncDirectory = dataRoot;
        }
    }
}
