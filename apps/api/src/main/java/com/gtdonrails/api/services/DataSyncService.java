package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.dtos.sync.DataSyncState;
import com.gtdonrails.api.dtos.sync.DataSyncStatusDto;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DataSyncService {

    private static final Logger logger = LoggerFactory.getLogger(DataSyncService.class);

    private final DataSyncProperties dataSyncProperties;
    private final RcloneDataSyncService rcloneDataSyncService;
    private final Path dataRoot;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private volatile DataSyncState state = DataSyncState.DISABLED;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public DataSyncService(
        DataSyncProperties dataSyncProperties,
        RcloneDataSyncService rcloneDataSyncService,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.dataSyncProperties = dataSyncProperties;
        this.rcloneDataSyncService = rcloneDataSyncService;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.state = rcloneDataSyncService.isEnabled() ? DataSyncState.SYNCED : DataSyncState.DISABLED;
    }

    /**
     * Runs blocking startup File Sync before PostgreSQL opens.
     *
     * <p>Example: {@code dataSyncService.syncOnStartup()}.</p>
     */
    public void syncOnStartup() throws IOException {
        Files.createDirectories(dataRoot);
        if (!rcloneDataSyncService.isEnabled()) {
            state = DataSyncState.DISABLED;
            return;
        }

        runOnce(!syncCheckExists(), "startup");
    }

    /** Completes a blocking File Sync before bootstrap hands off to normal startup.
     *
     * <p>Example: {@code dataSyncService.syncNow()}.</p>
     */
    public void syncNow() throws IOException {
        Files.createDirectories(dataRoot);
        if (!rcloneDataSyncService.isEnabled()) return;
        runOnce(false, "database setup");
    }

    /**
     * Queues the periodic data sync requested by the scheduler.
     *
     * <p>Example: {@code dataSyncService.requestScheduledSync()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.sync.interval-ms:300000}")
    public void requestScheduledSync() {
        requestSync("scheduled");
    }

    /**
     * Queues data sync work while recording the reason for observability.
     *
     * <p>Example: {@code dataSyncService.requestSync("item updated")}.</p>
     */
    public void requestSync(String reason) {
        if (!rcloneDataSyncService.isEnabled()) {
            state = DataSyncState.DISABLED;
            return;
        }

        pending.set(true);
        submit(!syncCheckExists(), reason);
    }

    /**
     * Queues data sync work requested directly by the API.
     *
     * <p>Example: {@code dataSyncService.requestManualSync()}.</p>
     */
    public void requestManualSync() {
        requestSync("manual");
    }

    /**
     * Returns the latest data sync state for status endpoints.
     *
     * <p>Example: {@code dataSyncService.status()}.</p>
     */
    public DataSyncStatusDto status() {
        return new DataSyncStatusDto(state, pending.get(), running.get(), lastStartedAt, lastFinishedAt, lastSuccessfulSyncAt, lastError);
    }

    private void submit(boolean bootstrap, String reason) {
        if (!running.compareAndSet(false, true)) return;
        executorService.submit(() -> runSyncLoop(bootstrap, reason));
    }

    private void runSyncLoop(boolean bootstrap, String reason) {
        boolean shouldBootstrap = bootstrap;
        try {
            do {
                pending.set(false);
                runOnce(shouldBootstrap, reason);
                shouldBootstrap = !syncCheckExists();
            } while (pending.get());
        } finally {
            running.set(false);
            if (pending.get()) submit(false, "pending");
        }
    }

    private void runOnce(boolean bootstrap, String reason) {
        lastStartedAt = Instant.now();
        state = bootstrap ? DataSyncState.BOOTSTRAPPING : DataSyncState.SYNCING;
        logger.atInfo()
            .addKeyValue("event", "data_sync_started")
            .addKeyValue("sync_mode", bootstrap ? "bootstrap" : "bisync")
            .addKeyValue("reason", reason)
            .log("Starting data sync");

        try {
            performSyncAttempt(bootstrap);
        } catch (RuntimeException exception) {
            lastError = exception.getMessage();
            state = DataSyncState.FAILED;
            logger.atWarn().addKeyValue("event", "data_sync_failed").addKeyValue("reason", reason).setCause(exception).log("Data sync failed");
            throw exception;
        } finally {
            lastFinishedAt = Instant.now();
        }
    }

    private void performSyncAttempt(boolean bootstrap) {
        runRcloneSync(bootstrap);
        if (bootstrap) publishMissingSyncCheckAfterBootstrap();
        markSyncSucceeded();
    }

    private void runRcloneSync(boolean bootstrap) {
        if (bootstrap) {
            rcloneDataSyncService.bootstrapBisync(dataRoot);
            return;
        }

        rcloneDataSyncService.bisync(dataRoot);
    }

    private void markSyncSucceeded() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        state = pending.get() ? DataSyncState.PENDING : DataSyncState.SYNCED;
    }

    private void publishMissingSyncCheckAfterBootstrap() {
        if (syncCheckExists()) return;

        writeSyncCheckFile();
        rcloneDataSyncService.publishBootstrapSyncCheck(dataRoot);
    }

    private void writeSyncCheckFile() {
        try {
            Files.writeString(syncCheckPath(), Instant.now().toString());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write data sync check file: " + syncCheckPath(), exception);
        }
    }

    private Path syncCheckPath() {
        return dataRoot.resolve(dataSyncProperties.getSyncCheckFilename());
    }

    private boolean syncCheckExists() {
        return Files.exists(syncCheckPath());
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }
}
