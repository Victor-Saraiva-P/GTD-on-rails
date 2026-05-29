package com.gtdonrails.api.services;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncState;
import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncStatusDto;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarEventQueueService {

    private static final int MAX_ATTEMPTS = 3;

    private final GoogleCalendarEventSyncService syncService;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final Object lock = new Object();
    private final LinkedHashMap<UUID, GoogleCalendarPendingOperation> pendingOperations = new LinkedHashMap<>();
    private final long retryBackoffMillis;

    private volatile GoogleCalendarSyncState state = GoogleCalendarSyncState.SYNCED;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public GoogleCalendarEventQueueService(GoogleCalendarEventSyncService syncService) {
        this(syncService, 100);
    }

    GoogleCalendarEventQueueService(GoogleCalendarEventSyncService syncService, long retryBackoffMillis) {
        this.syncService = syncService;
        this.retryBackoffMillis = retryBackoffMillis;
    }

    /**
     * Queues an upsert for the latest active GTD calendar state.
     *
     * <p>Example: {@code queueService.requestUpsert(itemId)}.</p>
     */
    public void requestUpsert(UUID itemId) {
        enqueue(itemId, GoogleCalendarPendingOperationType.UPSERT);
    }

    /**
     * Queues deletion from every derived GTD Google calendar.
     *
     * <p>Example: {@code queueService.requestDelete(itemId)}.</p>
     */
    public void requestDelete(UUID itemId) {
        enqueue(itemId, GoogleCalendarPendingOperationType.DELETE);
    }

    /**
     * Returns current Google Calendar mirror queue state.
     *
     * <p>Example: {@code queueService.status()}.</p>
     */
    public GoogleCalendarSyncStatusDto status() {
        return new GoogleCalendarSyncStatusDto(
            state,
            hasPendingOperations(),
            running.get(),
            lastStartedAt,
            lastFinishedAt,
            lastSuccessfulSyncAt,
            lastError);
    }

    private void enqueue(UUID itemId, GoogleCalendarPendingOperationType operationType) {
        requireItemId(itemId);
        synchronized (lock) {
            pendingOperations.put(itemId, new GoogleCalendarPendingOperation(itemId, operationType));
        }
        state = running.get() ? GoogleCalendarSyncState.SYNCING : GoogleCalendarSyncState.PENDING;
        submit();
    }

    private void submit() {
        if (!running.compareAndSet(false, true)) return;
        executorService.submit(this::runSyncLoop);
    }

    private void runSyncLoop() {
        try {
            runPendingOperations();
        } finally {
            running.set(false);
            if (hasPendingOperations()) submit();
        }
    }

    private void runPendingOperations() {
        GoogleCalendarPendingOperation operation = pollOperation();
        while (operation != null) {
            runWithRetries(operation);
            operation = pollOperation();
        }
    }

    private GoogleCalendarPendingOperation pollOperation() {
        synchronized (lock) {
            if (pendingOperations.isEmpty()) return null;
            Map.Entry<UUID, GoogleCalendarPendingOperation> entry = pendingOperations.entrySet().iterator().next();
            pendingOperations.remove(entry.getKey());
            return entry.getValue();
        }
    }

    private void runWithRetries(GoogleCalendarPendingOperation operation) {
        lastStartedAt = Instant.now();
        state = GoogleCalendarSyncState.SYNCING;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            if (runAttempt(operation, attempt)) return;
        }
    }

    private boolean runAttempt(GoogleCalendarPendingOperation operation, int attempt) {
        try {
            runOperation(operation);
            markSyncSucceeded();
            return true;
        } catch (RuntimeException exception) {
            markSyncFailed(exception);
            backoffBeforeRetry(attempt);
            return false;
        }
    }

    private void runOperation(GoogleCalendarPendingOperation operation) {
        if (operation.operationType() == GoogleCalendarPendingOperationType.DELETE) {
            syncService.deleteCalendarEvent(operation.itemId());
            return;
        }
        syncService.syncCalendarEvent(operation.itemId());
    }

    private void markSyncSucceeded() {
        lastFinishedAt = Instant.now();
        lastSuccessfulSyncAt = lastFinishedAt;
        lastError = null;
        state = hasPendingOperations() ? GoogleCalendarSyncState.PENDING : GoogleCalendarSyncState.SYNCED;
    }

    private void markSyncFailed(RuntimeException exception) {
        lastFinishedAt = Instant.now();
        lastError = exception.getMessage();
        state = GoogleCalendarSyncState.FAILED;
    }

    private void backoffBeforeRetry(int attempt) {
        if (attempt >= MAX_ATTEMPTS || retryBackoffMillis <= 0) return;
        try {
            Thread.sleep(retryBackoffMillis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean hasPendingOperations() {
        synchronized (lock) {
            return !pendingOperations.isEmpty();
        }
    }

    private void requireItemId(UUID itemId) {
        if (itemId == null) {
            throw new IllegalArgumentException("itemId value 'null' is invalid; expected UUID");
        }
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }

    private enum GoogleCalendarPendingOperationType {
        UPSERT,
        DELETE
    }

    private record GoogleCalendarPendingOperation(
        UUID itemId,
        GoogleCalendarPendingOperationType operationType
    ) {
    }
}
