package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.dtos.assets.AssetSyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class AssetSyncServiceTests {

    @TempDir
    private Path tempDir;

    @Mock
    private RcloneAssetSyncService rcloneAssetSyncService;

    private AssetSyncService service;

    @AfterEach
    void tearDown() {
        if (service != null) {
            service.shutdown();
        }
    }

    @Test
    void staysDisabledWhenRcloneIsDisabled() throws Exception {
        service = new AssetSyncService(properties(), rcloneAssetSyncService);

        when(rcloneAssetSyncService.isEnabled()).thenReturn(false);

        service.run(null);

        assertEquals(AssetSyncState.DISABLED, service.status().state());
    }

    @Test
    void bootstrapsWhenBaselineMarkerIsMissing() throws Exception {
        AssetsProperties properties = properties();
        Path localDirectory = Path.of(properties.getLocalDirectory()).toAbsolutePath().normalize();
        service = new AssetSyncService(properties, rcloneAssetSyncService);

        when(rcloneAssetSyncService.isEnabled()).thenReturn(true);

        service.run(null);
        waitForIdle();

        verify(rcloneAssetSyncService).bootstrapBisync(localDirectory);
        assertEquals(AssetSyncState.SYNCED, service.status().state());
        assertEquals(true, Files.exists(baselineMarker(properties)));
    }

    @Test
    void runsNormalBisyncWhenBaselineMarkerExists() throws Exception {
        AssetsProperties properties = properties();
        Path localDirectory = Path.of(properties.getLocalDirectory()).toAbsolutePath().normalize();
        Files.createDirectories(baselineMarker(properties).getParent());
        Files.writeString(baselineMarker(properties), "ready");
        service = new AssetSyncService(properties, rcloneAssetSyncService);

        when(rcloneAssetSyncService.isEnabled()).thenReturn(true);

        service.run(null);
        waitForIdle();

        verify(rcloneAssetSyncService).bisync(localDirectory);
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
}
