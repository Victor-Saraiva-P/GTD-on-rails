package com.gtdonrails.syncserver;

import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.annotation.PreDestroy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarProjectionQueue {

    private static final int BATCH_SIZE = 25;

    private final GoogleCalendarProjectionService projection;
    private final GoogleCalendarMirrorStore store;
    private final GoogleCalendarCredentialsStore credentials;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);

    private volatile String state = "DISABLED";
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public GoogleCalendarProjectionQueue(
        GoogleCalendarProjectionService projection,
        GoogleCalendarMirrorStore store,
        GoogleCalendarCredentialsStore credentials
    ) {
        this.projection = projection;
        this.store = store;
        this.credentials = credentials;
        refreshIdleState();
    }

    public void request(String itemId) {
        if (itemId == null || itemId.isBlank()) return;
        store.enqueueRefresh(itemId);
        wake();
    }

    public void wake() {
        refreshIdleState();
        submit();
    }

    @Scheduled(fixedDelayString = "$" + "{gtd.sync-server.google-calendar.interval-ms:5000}")
    public void scheduledSync() {
        if (store.pendingCount() == 0) {
            refreshIdleState();
            return;
        }
        submit();
    }

    public GoogleCalendarSyncStatus status() {
        long pendingCount = store.pendingCount();
        String effectiveState = statusState(pendingCount);
        return new GoogleCalendarSyncStatus(
            effectiveState,
            pendingCount > 0,
            running.get(),
            pendingCount,
            lastStartedAt,
            lastFinishedAt,
            lastSuccessfulSyncAt,
            lastError
        );
    }

    private void submit() {
        if (!credentials.credentialsConfigured() || !credentials.connected()) {
            refreshIdleState();
            return;
        }
        if (!running.compareAndSet(false, true)) return;
        executor.submit(this::runBatch);
    }

    private void runBatch() {
        lastStartedAt = Instant.now();
        state = "SYNCING";
        try {
            boolean successful = processPending();
            if (successful) markSuccess();
        } finally {
            running.set(false);
            lastFinishedAt = Instant.now();
        }
    }

    private boolean processPending() {
        for (var pending : store.pending(BATCH_SIZE)) {
            if (!processOne(pending.objectId())) return false;
        }
        return true;
    }

    private boolean processOne(String objectId) {
        try {
            projection.project(objectId);
            store.markCompleted(objectId);
            return true;
        } catch (RuntimeException exception) {
            lastError = exception.getMessage();
            state = "FAILED";
            store.markFailed(objectId, exception.getMessage());
            return false;
        }
    }

    private void markSuccess() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        refreshIdleState();
    }

    private void refreshIdleState() {
        if (!credentials.credentialsConfigured()) {
            state = "DISABLED";
            return;
        }
        if (!credentials.connected()) {
            state = "PENDING";
            return;
        }
        state = store.pendingCount() > 0 ? "PENDING" : "SYNCED";
    }

    private String statusState(long pendingCount) {
        if (running.get()) return "SYNCING";
        if ("FAILED".equals(state) && pendingCount > 0) return "FAILED";
        if (!credentials.credentialsConfigured()) return "DISABLED";
        if (!credentials.connected()) return pendingCount > 0 ? "PENDING" : "DISABLED";
        return pendingCount > 0 ? "PENDING" : "SYNCED";
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public record GoogleCalendarSyncStatus(
        String state,
        boolean pending,
        boolean running,
        long pendingCount,
        Instant lastStartedAt,
        Instant lastFinishedAt,
        Instant lastSuccessfulSyncAt,
        String lastError
    ) {
    }
}
