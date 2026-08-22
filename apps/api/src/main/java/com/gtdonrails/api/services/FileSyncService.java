package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.config.FileSyncProperties;
import com.gtdonrails.api.dtos.sync.FileSyncState;
import com.gtdonrails.api.dtos.sync.FileSyncStatusDto;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class FileSyncService {

    private static final Logger logger = LoggerFactory.getLogger(FileSyncService.class);

    private final FileSyncProperties fileSyncProperties;
    private final RcloneFileSyncService rcloneFileSyncService;
    private final Path dataRoot;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final Object syncLock = new Object();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private volatile FileSyncState state = FileSyncState.DISABLED;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public FileSyncService(
        FileSyncProperties fileSyncProperties,
        RcloneFileSyncService rcloneFileSyncService,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.fileSyncProperties = fileSyncProperties;
        this.rcloneFileSyncService = rcloneFileSyncService;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.state = rcloneFileSyncService.isEnabled() ? FileSyncState.SYNCED : FileSyncState.DISABLED;
    }

    /**
     * Runs blocking startup File Sync before PostgreSQL opens.
     *
     * <p>Example: {@code fileSyncService.syncOnStartup()}.</p>
     */
    public void syncOnStartup() throws IOException {
        Files.createDirectories(dataRoot);
        if (!rcloneFileSyncService.isEnabled()) {
            state = FileSyncState.DISABLED;
            return;
        }

        runOnce(!syncCheckExists(), "startup");
    }

    /**
     * Completes a blocking File Sync before bootstrap hands off to normal startup.
     *
     * <p>Example: {@code fileSyncService.syncNow()}.</p>
     */
    public void syncNow() throws IOException {
        Files.createDirectories(dataRoot);
        if (!rcloneFileSyncService.isEnabled()) return;
        runOnce(false, "database setup");
    }

    /**
     * Queues the periodic File Sync requested by the scheduler.
     *
     * <p>Example: {@code fileSyncService.requestScheduledSync()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.sync.interval-ms:300000}")
    public void requestScheduledSync() {
        requestSync("scheduled");
    }

    /**
     * Queues File Sync work while recording the reason for observability.
     *
     * <p>Example: {@code fileSyncService.requestSync("asset uploaded")}.</p>
     */
    public void requestSync(String reason) {
        if (!rcloneFileSyncService.isEnabled()) {
            state = FileSyncState.DISABLED;
            return;
        }

        pending.set(true);
        submit(!syncCheckExists(), reason);
    }

    /**
     * Queues File Sync after the current transaction commits.
     *
     * <p>Example: {@code fileSyncService.requestSyncAfterCommit(executor, "asset uploaded")}.</p>
     */
    public void requestSyncAfterCommit(AfterCommitExecutor executor, String reason) {
        executor.run(() -> requestSync(reason));
    }

    /**
     * Queues File Sync work requested directly by the API.
     *
     * <p>Example: {@code fileSyncService.requestManualSync()}.</p>
     */
    public void requestManualSync() {
        requestSync("manual");
    }

    /**
     * Returns the latest File Sync state for status endpoints.
     *
     * <p>Example: {@code fileSyncService.status()}.</p>
     */
    public FileSyncStatusDto status() {
        return new FileSyncStatusDto(state, pending.get(), running.get(), lastStartedAt, lastFinishedAt, lastSuccessfulSyncAt, lastError);
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
        state = bootstrap ? FileSyncState.BOOTSTRAPPING : FileSyncState.SYNCING;
        logger.atInfo()
            .addKeyValue("event", "file_sync_started")
            .addKeyValue("sync_mode", bootstrap ? "bootstrap" : "bisync")
            .addKeyValue("reason", reason)
            .log("Starting file sync");

        try {
            performSyncAttempt(bootstrap);
        } catch (RuntimeException exception) {
            lastError = exception.getMessage();
            state = FileSyncState.FAILED;
            logger.atWarn().addKeyValue("event", "file_sync_failed").addKeyValue("reason", reason).setCause(exception).log("File sync failed");
            throw exception;
        } finally {
            lastFinishedAt = Instant.now();
        }
    }

    private void performSyncAttempt(boolean bootstrap) {
        synchronized (syncLock) {
            runRcloneSync(bootstrap);
            if (bootstrap) publishMissingSyncCheckAfterBootstrap();
            markSyncSucceeded();
        }
    }

    private void runRcloneSync(boolean bootstrap) {
        if (bootstrap) {
            rcloneFileSyncService.bootstrapBisync(dataRoot);
            return;
        }

        rcloneFileSyncService.bisync(dataRoot);
    }

    private void markSyncSucceeded() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        state = pending.get() ? FileSyncState.PENDING : FileSyncState.SYNCED;
    }

    private void publishMissingSyncCheckAfterBootstrap() {
        if (syncCheckExists()) return;

        writeSyncCheckFile();
        rcloneFileSyncService.publishBootstrapSyncCheck(dataRoot);
    }

    private void writeSyncCheckFile() {
        try {
            Files.writeString(syncCheckPath(), Instant.now().toString());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write file sync check file: " + syncCheckPath(), exception);
        }
    }

    private Path syncCheckPath() {
        return dataRoot.resolve(fileSyncProperties.getSyncCheckFilename());
    }

    private boolean syncCheckExists() {
        return Files.exists(syncCheckPath());
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
        try {
            executorService.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
