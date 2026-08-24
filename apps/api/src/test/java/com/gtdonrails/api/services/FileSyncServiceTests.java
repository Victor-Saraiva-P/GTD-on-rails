package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.FileSyncProperties;
import com.gtdonrails.api.dtos.sync.FileSyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class FileSyncServiceTests {

    @TempDir
    private Path tempDir;

    private FileSyncService service;

    @AfterEach
    void tearDown() {
        if (service != null) service.shutdown();
    }

    @Test
    void staysDisabledWhenRcloneIsDisabled() throws Exception {
        FakeRcloneFileSyncService rcloneFileSyncService = new FakeRcloneFileSyncService();
        service = new FileSyncService(properties(), rcloneFileSyncService, tempDir.toString());

        rcloneFileSyncService.enabled = false;

        service.syncOnStartup();

        assertEquals(FileSyncState.DISABLED, service.status().state());
    }

    @Test
    void bootstrapsFromRemoteWhenSyncCheckIsMissing() throws Exception {
        FakeRcloneFileSyncService rcloneFileSyncService = new FakeRcloneFileSyncService();
        service = new FileSyncService(properties(), rcloneFileSyncService, tempDir.toString());

        rcloneFileSyncService.enabled = true;

        service.syncOnStartup();

        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneFileSyncService.bootstrapBisyncDirectory);
        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneFileSyncService.bootstrapPublishDirectory);
        assertEquals(FileSyncState.SYNCED, service.status().state());
        assertTrue(Files.exists(syncCheckFile()));
    }

    @Test
    void runsNormalBisyncWhenSyncCheckExists() throws Exception {
        Files.writeString(syncCheckFile(), "ready");
        FakeRcloneFileSyncService rcloneFileSyncService = new FakeRcloneFileSyncService();
        service = new FileSyncService(properties(), rcloneFileSyncService, tempDir.toString());

        rcloneFileSyncService.enabled = true;

        service.syncOnStartup();

        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneFileSyncService.bisyncDirectory);
        assertEquals(null, rcloneFileSyncService.bootstrapBisyncDirectory);
        assertEquals(null, rcloneFileSyncService.bootstrapPublishDirectory);
        assertEquals(FileSyncState.SYNCED, service.status().state());
    }

    @Test
    void syncNowRunsBlockingBisyncEvenWhenSyncCheckExists() throws Exception {
        Files.writeString(syncCheckFile(), "ready");
        FakeRcloneFileSyncService rcloneFileSyncService = new FakeRcloneFileSyncService();
        service = new FileSyncService(properties(), rcloneFileSyncService, tempDir.toString());
        rcloneFileSyncService.enabled = true;

        service.syncNow();

        assertEquals(tempDir.toAbsolutePath().normalize(), rcloneFileSyncService.bisyncDirectory);
        assertEquals(FileSyncState.SYNCED, service.status().state());
    }

    @Test
    void queuesFileSyncAfterCommit() {
        FakeRcloneFileSyncService rcloneFileSyncService = new FakeRcloneFileSyncService();
        service = new FileSyncService(properties(), rcloneFileSyncService, tempDir.toString());
        rcloneFileSyncService.enabled = true;

        service.requestSyncAfterCommit(new AfterCommitExecutor(), "asset updated");

        assertTrue(service.status().pending() || service.status().running() || service.status().state() == FileSyncState.SYNCED);
    }

    private FileSyncProperties properties() {
        FileSyncProperties properties = new FileSyncProperties();
        properties.setSyncCheckFilename("gtd-on-rails-sync-check");
        return properties;
    }

    private Path syncCheckFile() {
        return tempDir.resolve("gtd-on-rails-sync-check");
    }

    private static class FakeRcloneFileSyncService extends RcloneFileSyncService {

        private boolean enabled;
        private Path bisyncDirectory;
        private Path bootstrapBisyncDirectory;
        private Path bootstrapPublishDirectory;

        private FakeRcloneFileSyncService() {
            super(new FileSyncProperties());
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

        @Override
        public void publishBootstrapSyncCheck(Path dataRoot) {
            bootstrapPublishDirectory = dataRoot;
        }
    }
}
