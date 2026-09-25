package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.dtos.sync.FileSyncState;
import com.gtdonrails.api.dtos.sync.FileSyncStatusDto;
import com.gtdonrails.api.sync.FileConflictResolutionService;
import com.gtdonrails.api.sync.LocalSyncStateStore;
import com.gtdonrails.api.sync.SyncDatasetEpochMismatchException;
import com.gtdonrails.api.sync.SyncFileBaseStore;
import com.gtdonrails.api.sync.SyncFileOutboxEntry;
import com.gtdonrails.api.sync.SyncFileOutboxStore;
import com.gtdonrails.api.sync.SyncFileServerGateway;
import com.gtdonrails.api.sync.SyncServerConflictException;
import com.gtdonrails.api.sync.SyncServerGateway;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class FileSyncService {

    private final SyncFileOutboxStore outbox;
    private final SyncFileServerGateway fileGateway;
    private final SyncServerGateway stateGateway;
    private final LocalSyncStateStore stateStore;
    private final SyncFileBaseStore baseStore;
    private final FileConflictResolutionService conflictResolver;
    private final Path dataRoot;
    private final boolean enabled;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);

    private volatile FileSyncState state;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    @Autowired
    public FileSyncService(
        SyncFileOutboxStore outbox,
        SyncFileServerGateway fileGateway,
        SyncServerGateway stateGateway,
        LocalSyncStateStore stateStore,
        SyncFileBaseStore baseStore,
        FileConflictResolutionService conflictResolver,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${gtd.sync.server.enabled:false}") boolean enabled
    ) {
        this.outbox = outbox;
        this.fileGateway = fileGateway;
        this.stateGateway = stateGateway;
        this.stateStore = stateStore;
        this.baseStore = baseStore;
        this.conflictResolver = conflictResolver;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.enabled = enabled;
        this.state = enabled ? FileSyncState.SYNCED : FileSyncState.DISABLED;
    }

    public void syncOnStartup() throws IOException {
        Files.createDirectories(dataRoot);
        if (!enabled) {
            state = FileSyncState.DISABLED;
            return;
        }
        syncNow();
    }

    public void syncNow() throws IOException {
        Files.createDirectories(dataRoot);
        if (!enabled) return;
        runOnce();
    }

    @Scheduled(fixedDelayString = "${gtd.sync.file-interval-ms:5000}")
    public void requestScheduledSync() {
        if (!enabled || requiresRebootstrap()) return;
        if (outbox.pendingCount() == 0) return;
        requestSync("scheduled");
    }

    public void requestSync(String reason) {
        if (!enabled || requiresRebootstrap()) return;
        pending.set(true);
        state = running.get() ? FileSyncState.SYNCING : FileSyncState.PENDING;
        submit();
    }

    public void requestSyncAfterCommit(AfterCommitExecutor executor, String reason) {
        executor.run(() -> requestSync(reason));
    }

    public void requestManualSync() {
        requestSync("manual");
    }

    public FileSyncStatusDto status() {
        return new FileSyncStatusDto(
            state, pending.get(), running.get(), outbox.pendingCount(),
            lastStartedAt, lastFinishedAt, lastSuccessfulSyncAt, lastError
        );
    }

    private void submit() {
        if (!running.compareAndSet(false, true)) return;
        executor.submit(this::runSyncLoop);
    }

    private void runSyncLoop() {
        boolean successful = true;
        try {
            do {
                pending.set(false);
                successful = runOnce();
            } while (shouldContinueLoop(successful));
        } finally {
            running.set(false);
            if (successful && pending.get() && !requiresRebootstrap()) requestSync("pending");
        }
    }

    private boolean shouldContinueLoop(boolean successful) {
        return successful
            && !requiresRebootstrap()
            && (pending.get() || outbox.pendingCount() > 0);
    }

    private boolean runOnce() {
        lastStartedAt = Instant.now();
        state = FileSyncState.SYNCING;
        try {
            validateDatasetEpoch();
            boolean successful = processPending();
            if (successful) markSuccess();
            else if (state != FileSyncState.CONFLICT) state = FileSyncState.FAILED;
            return successful;
        } catch (RuntimeException exception) {
            recordBatchFailure(exception);
            return false;
        } finally {
            lastFinishedAt = Instant.now();
        }
    }

    private void recordBatchFailure(RuntimeException exception) {
        lastError = exception.getMessage();
        state = exception instanceof SyncDatasetEpochMismatchException
            ? FileSyncState.REBOOTSTRAP_REQUIRED
            : FileSyncState.FAILED;
    }

    private boolean processPending() {
        List<SyncFileOutboxEntry> entries = outbox.pending();
        for (SyncFileOutboxEntry entry : entries) {
            if (!processEntry(entry)) return false;
        }
        return true;
    }

    private boolean processEntry(SyncFileOutboxEntry entry) {
        outbox.markProcessing(entry.id());
        byte[] content = localContent(entry);
        try {
            SyncServerGateway.SyncPushResult result = push(entry, content);
            rememberSuccessfulPush(entry, result.revision(), content);
            outbox.markCompleted(entry.id());
            return true;
        } catch (SyncServerConflictException conflict) {
            return resolveConflict(entry, conflict);
        } catch (RuntimeException exception) {
            handleFailure(entry, exception);
            return false;
        }
    }

    private byte[] localContent(SyncFileOutboxEntry entry) {
        return "DELETE".equals(entry.operation()) ? new byte[0] : readLocalFile(entry.relativePath());
    }

    private SyncServerGateway.SyncPushResult push(SyncFileOutboxEntry entry, byte[] content) {
        long baseRevision = stateStore.revision(entry.objectType(), entry.objectId());
        return fileGateway.push(
            entry.operationId(), entry.objectType(), entry.objectId(), baseRevision,
            entry.operation(), entry.relativePath(), entry.contentType(), content
        );
    }

    private void rememberSuccessfulPush(SyncFileOutboxEntry entry, long revision, byte[] content) {
        stateStore.updateRevision(entry.objectType(), entry.objectId(), revision);
        if ("DELETE".equals(entry.operation())) {
            baseStore.delete(entry.objectType(), entry.objectId());
            return;
        }
        baseStore.save(entry.objectType(), entry.objectId(), revision, content);
    }

    private boolean resolveConflict(
        SyncFileOutboxEntry entry,
        SyncServerConflictException conflict
    ) {
        FileConflictResolutionService.Resolution resolution =
            conflictResolver.resolvePushConflict(entry, conflict);
        if (resolution.mergedAutomatically()) return true;
        outbox.markFailed(entry.id(), conflict.getMessage(), false);
        lastError = conflict.getMessage();
        state = FileSyncState.CONFLICT;
        return false;
    }

    private void handleFailure(SyncFileOutboxEntry entry, RuntimeException exception) {
        outbox.markFailed(entry.id(), exception.getMessage(), true);
        lastError = exception.getMessage();
    }

    private byte[] readLocalFile(String relativePath) {
        Path path = dataRoot.resolve(relativePath).normalize();
        if (!path.startsWith(dataRoot)) {
            throw new IllegalArgumentException(
                "sync file path value '" + relativePath + "' is invalid; expected path inside data root"
            );
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to read local sync file at '" + path + "'",
                exception
            );
        }
    }

    private void validateDatasetEpoch() {
        SyncServerGateway.SyncRemoteState remote = stateGateway.state();
        LocalSyncStateStore.SyncClientState local = stateStore.clientState();
        if (local.datasetEpoch() == null || local.datasetEpoch().isBlank()) return;
        if (local.datasetEpoch().equals(remote.datasetEpoch())) return;
        throw new SyncDatasetEpochMismatchException(local.datasetEpoch(), remote.datasetEpoch());
    }

    private boolean requiresRebootstrap() {
        return state == FileSyncState.REBOOTSTRAP_REQUIRED;
    }

    public void resumeAfterRebootstrap() {
        if (!enabled) return;
        lastError = null;
        state = FileSyncState.SYNCED;
        requestSync("rebootstrap completed");
    }

    private void markSuccess() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        state = outbox.pendingCount() > 0 ? FileSyncState.PENDING : FileSyncState.SYNCED;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
        try {
            executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
