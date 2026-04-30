package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.dtos.assets.AssetSyncState;
import com.gtdonrails.api.dtos.assets.AssetSyncStatusDto;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AssetSyncService implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(AssetSyncService.class);

    private final AssetsProperties assetsProperties;
    private final RcloneAssetSyncService rcloneAssetSyncService;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private volatile AssetSyncState state = AssetSyncState.DISABLED;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public AssetSyncService(AssetsProperties assetsProperties, RcloneAssetSyncService rcloneAssetSyncService) {
        this.assetsProperties = assetsProperties;
        this.rcloneAssetSyncService = rcloneAssetSyncService;
    }

    /**
     * Initializes asset storage and queues startup sync when rclone is enabled.
     *
     * <p>Example: {@code assetSyncService.run(args)}.</p>
     */
    @Override
    public void run(ApplicationArguments args) throws IOException {
        Files.createDirectories(localDirectory());

        if (!rcloneAssetSyncService.isEnabled()) {
            state = AssetSyncState.DISABLED;
            return;
        }

        requestSync("startup");
    }

    /**
     * Queues the periodic asset sync requested by the scheduler.
     *
     * <p>Example: {@code assetSyncService.requestScheduledSync()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.assets.sync.interval-ms:300000}")
    public void requestScheduledSync() {
        requestSync("scheduled");
    }

    /**
     * Queues asset sync work while recording the reason for observability.
     *
     * <p>Example: {@code assetSyncService.requestSync("context icon updated")}.</p>
     */
    public void requestSync(String reason) {
        if (!rcloneAssetSyncService.isEnabled()) {
            state = AssetSyncState.DISABLED;
            return;
        }

        pending.set(true);
        submit(!baselineExists(), reason);
    }

    /**
     * Queues asset sync work requested directly by the API.
     *
     * <p>Example: {@code assetSyncService.requestManualSync()}.</p>
     */
    public void requestManualSync() {
        requestSync("manual");
    }

    /**
     * Returns the latest asset sync state for status endpoints.
     *
     * <p>Example: {@code assetSyncService.status()}.</p>
     */
    public AssetSyncStatusDto status() {
        return new AssetSyncStatusDto(
            state,
            pending.get(),
            running.get(),
            lastStartedAt,
            lastFinishedAt,
            lastSuccessfulSyncAt,
            lastError
        );
    }

    private void submit(boolean bootstrap, String reason) {
        if (!running.compareAndSet(false, true)) {
            return;
        }

        executorService.submit(() -> runSyncLoop(bootstrap, reason));
    }

    private void runSyncLoop(boolean bootstrap, String reason) {
        boolean shouldBootstrap = bootstrap;

        try {
            do {
                pending.set(false);
                runOnce(shouldBootstrap, reason);
                shouldBootstrap = !baselineExists();
            } while (pending.get());
        } finally {
            running.set(false);

            if (pending.get()) {
                submit(false, "pending");
            }
        }
    }

    private void runOnce(boolean bootstrap, String reason) {
        lastStartedAt = Instant.now();
        state = bootstrap ? AssetSyncState.BOOTSTRAPPING : AssetSyncState.SYNCING;
        logger.info("Starting asset {} sync ({})", bootstrap ? "bootstrap" : "bisync", reason);

        try {
            runRcloneSync(bootstrap);
            markSyncSucceeded();
        } catch (RuntimeException | IOException exception) {
            lastError = exception.getMessage();
            state = AssetSyncState.FAILED;
            logger.warn("Asset sync failed", exception);
        } finally {
            lastFinishedAt = Instant.now();
        }
    }

    private void runRcloneSync(boolean bootstrap) throws IOException {
        if (bootstrap) {
            rcloneAssetSyncService.bootstrapBisync(localDirectory());
            writeBaselineMarker();
            return;
        }

        rcloneAssetSyncService.bisync(localDirectory());
    }

    private void markSyncSucceeded() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        state = pending.get() ? AssetSyncState.PENDING : AssetSyncState.SYNCED;
    }

    private void writeBaselineMarker() throws IOException {
        Path markerPath = baselineMarkerPath();
        Files.createDirectories(markerPath.getParent());
        Files.writeString(markerPath, Instant.now().toString());
    }

    private Path localDirectory() {
        return Path.of(assetsProperties.getLocalDirectory()).toAbsolutePath().normalize();
    }

    private Path baselineMarkerPath() {
        return Path.of(assetsProperties.getSync().getStateDirectory())
            .toAbsolutePath()
            .normalize()
            .resolve(assetsProperties.getSync().getBaselineMarker());
    }

    private boolean baselineExists() {
        return Files.exists(baselineMarkerPath());
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }
}
