package com.gtdonrails.api.services;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import com.gtdonrails.api.dtos.sync.DatabaseSyncState;
import com.gtdonrails.api.dtos.sync.DatabaseSyncStatusDto;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxStatus;
import com.gtdonrails.api.repositories.SyncOutboxRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages the outbox-based sync of local SQLite mutations to remote Supabase PostgreSQL.
 *
 * <p>Example: {@code databaseSyncService.status()}.</p>
 */
@Service
public class DatabaseSyncService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseSyncService.class);
    private static final int MAX_RETRY_ATTEMPTS = 5;
    private static final int BATCH_SIZE = 50;

    private final SyncOutboxRepository outboxRepository;
    private final SupabasePushSyncService pushSyncService;
    private final SupabasePullSyncService pullSyncService;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);
    private final boolean enabled;

    private volatile DatabaseSyncState state = DatabaseSyncState.DISABLED;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    /**
     * Creates a database sync service with Spring-managed dependencies.
     *
     * @example new DatabaseSyncService(outboxRepository, pushSyncServiceProvider, pullSyncServiceProvider, true)
     */
    @Autowired
    public DatabaseSyncService(
        SyncOutboxRepository outboxRepository,
        ObjectProvider<SupabasePushSyncService> pushSyncServiceProvider,
        ObjectProvider<SupabasePullSyncService> pullSyncServiceProvider,
        @Value("${gtd.sync.database.enabled:false}") boolean enabled
    ) {
        this.outboxRepository = outboxRepository;
        this.pushSyncService = pushSyncServiceProvider.getIfAvailable();
        this.pullSyncService = pullSyncServiceProvider.getIfAvailable();
        this.enabled = enabled && this.pushSyncService != null;
        this.state = this.enabled ? DatabaseSyncState.SYNCED : DatabaseSyncState.DISABLED;
    }

    DatabaseSyncService(
        SyncOutboxRepository outboxRepository,
        SupabasePushSyncService pushSyncService,
        SupabasePullSyncService pullSyncService,
        boolean enabled
    ) {
        this.outboxRepository = outboxRepository;
        this.pushSyncService = pushSyncService;
        this.pullSyncService = pullSyncService;
        this.enabled = enabled && pushSyncService != null;
        this.state = this.enabled ? DatabaseSyncState.SYNCED : DatabaseSyncState.DISABLED;
    }

    DatabaseSyncService(
        SyncOutboxRepository outboxRepository,
        SupabasePushSyncService pushSyncService,
        boolean enabled
    ) {
        this(outboxRepository, pushSyncService, null, enabled);
    }

    /**
     * Returns the latest database sync state for status endpoints.
     *
     * <p>Example: {@code databaseSyncService.status()}.</p>
     */
    public DatabaseSyncStatusDto status() {
        int pendingCount = enabled ? countPending() : 0;
        return new DatabaseSyncStatusDto(
            state, pending.get(), running.get(), pendingCount,
            lastStartedAt, lastFinishedAt, lastSuccessfulSyncAt, lastError);
    }

    /**
     * Reports whether any outbox events are waiting to be synced.
     *
     * <p>Example: {@code databaseSyncService.hasPendingEvents()}.</p>
     */
    public boolean hasPendingEvents() {
        if (!enabled) return false;
        return countPending() > 0;
    }

    /**
     * Signals that new outbox events are available for sync.
     *
     * <p>Example: {@code databaseSyncService.notifyNewEvents()}.</p>
     */
    public void notifyNewEvents() {
        if (!enabled) return;

        pending.set(true);
        state = running.get() ? DatabaseSyncState.SYNCING : DatabaseSyncState.PENDING;
        submit();
    }

    /**
     * Processes pending outbox events on a fixed schedule.
     *
     * <p>Example: invoked by Spring scheduler.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.sync.database.interval-ms:5000}")
    public void requestScheduledSync() {
        if (!enabled) return;
        if (countPending() == 0) return;

        pending.set(true);
        submit();
    }

    private void submit() {
        if (!running.compareAndSet(false, true)) return;
        executorService.submit(this::runSyncLoop);
    }

    private void runSyncLoop() {
        try {
            do {
                pending.set(false);
                processBatch();
            } while (pending.get() || countPending() > 0);
        } finally {
            running.set(false);
            if (countPending() > 0) submit();
        }
    }

    /**
     * Reports whether database sync is enabled.
     *
     * <p>Example: {@code databaseSyncService.isEnabled()}.</p>
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Executes initial database sync on startup, pushing pending events and pulling remote state.
     *
     * <p>Example: {@code databaseSyncService.syncOnStartup()}.</p>
     */
    public void syncOnStartup() {
        if (!enabled) return;

        lastStartedAt = Instant.now();
        state = DatabaseSyncState.SYNCING;
        try {
            executeBatchSync();
            if (pullSyncService != null) pullSyncService.pullAll();
            markSyncSucceeded();
        } catch (RuntimeException exception) {
            markSyncFailed(exception);
        }
    }

    private void processBatch() {
        lastStartedAt = Instant.now();
        state = DatabaseSyncState.SYNCING;
        logBatchStart();

        try {
            executeBatchSync();
            if (pullSyncService != null) pullSyncService.pullAll();
            markSyncSucceeded();
        } catch (RuntimeException exception) {
            markSyncFailed(exception);
        }
    }

    private void logBatchStart() {
        logger.atInfo()
            .addKeyValue("event", "database_sync_started")
            .log("Starting database sync batch");
    }

    private void executeBatchSync() {
        List<SyncOutboxEvent> events = fetchPendingBatch();
        if (events.isEmpty()) return;
        pushEvents(events);
    }

    @Transactional(readOnly = true)
    protected List<SyncOutboxEvent> fetchPendingBatch() {
        return outboxRepository.findByStatusOrderByCreatedAtAsc(SyncOutboxStatus.PENDING)
            .stream()
            .limit(BATCH_SIZE)
            .toList();
    }

    private void pushEvents(List<SyncOutboxEvent> events) {
        for (SyncOutboxEvent event : events) {
            pushSingleEvent(event);
        }
    }

    @Transactional
    protected void pushSingleEvent(SyncOutboxEvent event) {
        event.markProcessing();
        outboxRepository.save(event);

        try {
            pushSyncService.pushEvent(event);
            event.markCompleted();
        } catch (RuntimeException exception) {
            handleEventFailure(event, exception);
        }

        outboxRepository.save(event);
    }

    private void handleEventFailure(SyncOutboxEvent event, RuntimeException exception) {
        event.markFailed(exception.getMessage());
        if (event.getRetryCount() < MAX_RETRY_ATTEMPTS) {
            event.resetToPending();
        }

        logger.atWarn()
            .addKeyValue("event", "database_sync_event_failed")
            .addKeyValue("entityType", event.getEntityType())
            .addKeyValue("entityId", event.getEntityId())
            .addKeyValue("retryCount", event.getRetryCount())
            .setCause(exception)
            .log("Failed to sync outbox event");
    }

    private void markSyncSucceeded() {
        lastFinishedAt = Instant.now();
        lastSuccessfulSyncAt = lastFinishedAt;
        lastError = null;
        state = countPending() > 0 ? DatabaseSyncState.PENDING : DatabaseSyncState.SYNCED;
    }

    private void markSyncFailed(RuntimeException exception) {
        lastFinishedAt = Instant.now();
        lastError = exception.getMessage();
        state = DatabaseSyncState.FAILED;

        logger.atWarn()
            .addKeyValue("event", "database_sync_batch_failed")
            .setCause(exception)
            .log("Database sync batch failed");
    }

    private int countPending() {
        try {
            return outboxRepository.countByStatus(SyncOutboxStatus.PENDING);
        } catch (RuntimeException exception) {
            return 0;
        }
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
        try {
            executorService.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
