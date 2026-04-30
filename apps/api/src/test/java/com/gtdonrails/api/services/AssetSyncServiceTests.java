package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.dtos.assets.AssetSyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class AssetSyncServiceTests {

    @TempDir
    private Path tempDir;

    private AssetSyncService service;

    @AfterEach
    void tearDown() {
        if (service != null) {
            service.shutdown();
        }
    }

    @Test
    void staysDisabledWhenRcloneIsDisabled() throws Exception {
        FakeRcloneAssetSyncService rcloneAssetSyncService = new FakeRcloneAssetSyncService();
        service = new AssetSyncService(properties(), rcloneAssetSyncService);

        rcloneAssetSyncService.enabled = false;

        service.run(null);

        assertEquals(AssetSyncState.DISABLED, service.status().state());
    }

    @Test
    void bootstrapsWhenBaselineMarkerIsMissing() throws Exception {
        AssetsProperties properties = properties();
        Path localDirectory = Path.of(properties.getLocalDirectory()).toAbsolutePath().normalize();
        FakeRcloneAssetSyncService rcloneAssetSyncService = new FakeRcloneAssetSyncService();
        service = new AssetSyncService(properties, rcloneAssetSyncService);

        rcloneAssetSyncService.enabled = true;

        service.run(null);
        waitForIdle();

        assertEquals(localDirectory, rcloneAssetSyncService.bootstrapBisyncDirectory);
        assertEquals(AssetSyncState.SYNCED, service.status().state());
        assertTrue(Files.exists(baselineMarker(properties)));
    }

    @Test
    void runsNormalBisyncWhenBaselineMarkerExists() throws Exception {
        AssetsProperties properties = properties();
        Path localDirectory = Path.of(properties.getLocalDirectory()).toAbsolutePath().normalize();
        Files.createDirectories(baselineMarker(properties).getParent());
        Files.writeString(baselineMarker(properties), "ready");
        FakeRcloneAssetSyncService rcloneAssetSyncService = new FakeRcloneAssetSyncService();
        service = new AssetSyncService(properties, rcloneAssetSyncService);

        rcloneAssetSyncService.enabled = true;

        service.run(null);
        waitForIdle();

        assertEquals(localDirectory, rcloneAssetSyncService.bisyncDirectory);
        assertEquals(AssetSyncState.SYNCED, service.status().state());
    }

    private AssetsProperties properties() {
        AssetsProperties properties = new AssetsProperties();
        properties.setLocalDirectory(tempDir.resolve("assets").toString());
        properties.getSync().setStateDirectory(tempDir.resolve("sync-state").toString());
        properties.getSync().setBaselineMarker("ready");
        return properties;
    }

    private Path baselineMarker(AssetsProperties properties) {
        return Path.of(properties.getSync().getStateDirectory())
            .toAbsolutePath()
            .normalize()
            .resolve(properties.getSync().getBaselineMarker());
    }

    private void waitForIdle() throws InterruptedException {
        for (int attempt = 0; attempt < 50; attempt += 1) {
            if (!service.status().running() && !service.status().pending()) {
                return;
            }

            Thread.sleep(20);
        }
    }

    private static class FakeRcloneAssetSyncService extends RcloneAssetSyncService {

        private boolean enabled;
        private Path bisyncDirectory;
        private Path bootstrapBisyncDirectory;

        private FakeRcloneAssetSyncService() {
            super(new AssetsProperties());
        }

        @Override
        public boolean isEnabled() {
            return enabled;
        }

        @Override
        public void bisync(Path localDirectory) {
            bisyncDirectory = localDirectory;
        }

        @Override
        public void bootstrapBisync(Path localDirectory) {
            bootstrapBisyncDirectory = localDirectory;
        }
    }
}
