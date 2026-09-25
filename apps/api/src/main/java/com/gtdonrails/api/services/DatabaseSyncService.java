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
import com.gtdonrails.api.sync.SyncServerBootstrapService;
import com.gtdonrails.api.sync.DomainChangeEventHub;
import com.gtdonrails.api.sync.LocalSyncStateStore;
import com.gtdonrails.api.sync.SyncDatasetEpochMismatchException;
import com.gtdonrails.api.sync.SyncServerConflictException;
import com.gtdonrails.api.sync.SyncServerRebootstrapService;
import com.gtdonrails.api.sync.SyncServerPullService;
import com.gtdonrails.api.sync.SyncServerPushService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Manages outbox-based synchronization between local SQLite and the GTD sync server.
 *
 * <p>Example: {@code databaseSyncService.status()}.</p>
 */
@Service
public class DatabaseSyncService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseSyncService.class);
    private static final int BATCH_SIZE = 50;

    private final SyncOutboxRepository outboxRepository;
    private final SyncServerPushService pushSyncService;
    private final SyncServerPullService pullSyncService;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean pending = new AtomicBoolean(false);
    private final boolean enabled;
    private final SyncServerBootstrapService bootstrapService;
    private final SyncServerRebootstrapService rebootstrapService;
    private final LocalSyncStateStore localSyncStateStore;
    private final DomainChangeEventHub eventHub;

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
        ObjectProvider<SyncServerPushService> pushSyncServiceProvider,
        ObjectProvider<SyncServerPullService> pullSyncServiceProvider,
        ObjectProvider<SyncServerBootstrapService> bootstrapServiceProvider,
        ObjectProvider<SyncServerRebootstrapService> rebootstrapServiceProvider,
        ObjectProvider<LocalSyncStateStore> localSyncStateStoreProvider,
        ObjectProvider<DomainChangeEventHub> eventHubProvider,
        @Value("${gtd.sync.server.enabled:false}") boolean enabled
    ) {
        this.outboxRepository = outboxRepository;
        this.pushSyncService = pushSyncServiceProvider.getIfAvailable();
        this.pullSyncService = pullSyncServiceProvider.getIfAvailable();
        this.bootstrapService = bootstrapServiceProvider.getIfAvailable();
        this.rebootstrapService = rebootstrapServiceProvider.getIfAvailable();
        this.localSyncStateStore = localSyncStateStoreProvider.getIfAvailable();
        this.eventHub = eventHubProvider.getIfAvailable();
        this.enabled = enabled && this.pushSyncService != null;
        this.state = this.enabled ? DatabaseSyncState.SYNCED : DatabaseSyncState.DISABLED;
    }

    DatabaseSyncService(
        SyncOutboxRepository outboxRepository,
        SyncServerPushService pushSyncService,
        SyncServerPullService pullSyncService,
        boolean enabled
    ) {
        this.outboxRepository = outboxRepository;
        this.pushSyncService = pushSyncService;
        this.pullSyncService = pullSyncService;
        this.bootstrapService = null;
        this.rebootstrapService = null;
        this.localSyncStateStore = null;
        this.eventHub = null;
        this.enabled = enabled && pushSyncService != null;
        this.state = this.enabled ? DatabaseSyncState.SYNCED : DatabaseSyncState.DISABLED;
    }

    DatabaseSyncService(
        SyncOutboxRepository outboxRepository,
        SyncServerPushService pushSyncService,
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
            state, pending.get(), running.get(), pendingCount, pendingConflictCount(),
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
        if (!enabled || requiresRebootstrap()) return;

        pending.set(true);
        state = running.get() ? DatabaseSyncState.SYNCING : DatabaseSyncState.PENDING;
        publishStatus();
        submit();
    }

    /**
     * Processes pending outbox events on a fixed schedule.
     *
     * <p>Example: invoked by Spring scheduler.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.sync.database.interval-ms:5000}")
    public void requestScheduledSync() {
        if (!enabled || requiresRebootstrap()) return;
        if (countPending() == 0) return;

        pending.set(true);
        submit();
    }

    private void submit() {
        if (!running.compareAndSet(false, true)) return;
        publishStatus();
        executorService.submit(this::runSyncLoop);
    }

    private void runSyncLoop() {
        boolean successful = true;
        try {
            do {
                pending.set(false);
                successful = processBatch();
            } while (shouldContinueLoop(successful));
        } finally {
            running.set(false);
            publishStatus();
            if (successful && pending.get() && !requiresRebootstrap()) submit();
        }
    }

    private boolean shouldContinueLoop(boolean successful) {
        return successful
            && !requiresRebootstrap()
            && (pending.get() || countPending() > 0);
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
        publishStatus();
        try {
            if (bootstrapService != null) bootstrapService.initializeIfNeeded();
            validateDatasetEpoch();
            executeBatchSync();
            if (pullSyncService != null) pullSyncService.pullAll();
            markSyncSucceeded();
        } catch (RuntimeException exception) {
            markSyncFailed(exception);
        }
    }

    private boolean processBatch() {
        lastStartedAt = Instant.now();
        state = DatabaseSyncState.SYNCING;
        publishStatus();
        logBatchStart();

        try {
            validateDatasetEpoch();
            if (!executeBatchSync()) return finishUnsuccessfulBatch();
            if (pullSyncService != null) pullSyncService.pullAll();
            markSyncSucceeded();
            return true;
        } catch (RuntimeException exception) {
            markSyncFailed(exception);
            return false;
        }
    }

    private boolean finishUnsuccessfulBatch() {
        lastFinishedAt = Instant.now();
        return false;
    }

    private void logBatchStart() {
        logger.atInfo()
            .addKeyValue("event", "database_sync_started")
            .log("Starting database sync batch");
    }

    private boolean executeBatchSync() {
        List<SyncOutboxEvent> events = fetchPendingBatch();
        return events.isEmpty() || pushEvents(events);
    }

    protected List<SyncOutboxEvent> fetchPendingBatch() {
        return outboxRepository.findByStatusOrderByCreatedAtAsc(SyncOutboxStatus.PENDING)
            .stream()
            .limit(BATCH_SIZE)
            .toList();
    }

    private boolean pushEvents(List<SyncOutboxEvent> events) {
        for (SyncOutboxEvent event : events) {
            if (!pushSingleEvent(event)) return false;
        }
        return true;
    }

    protected boolean pushSingleEvent(SyncOutboxEvent event) {
        event.markProcessing();
        outboxRepository.save(event);
        boolean pushed = tryPushEvent(event);
        outboxRepository.save(event);
        return pushed;
    }

    private boolean tryPushEvent(SyncOutboxEvent event) {
        try {
            pushSyncService.pushEvent(event);
            event.markCompleted();
            return true;
        } catch (RuntimeException exception) {
            handleEventFailure(event, exception);
            return false;
        }
    }

    private void handleEventFailure(SyncOutboxEvent event, RuntimeException exception) {
        event.markFailed(exception.getMessage());
        lastError = exception.getMessage();
        if (exception instanceof SyncServerConflictException) {
            state = DatabaseSyncState.CONFLICT;
        } else {
            event.resetToPending();
            state = DatabaseSyncState.FAILED;
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
        if (pendingConflictCount() > 0) state = DatabaseSyncState.CONFLICT;
        else state = countPending() > 0 ? DatabaseSyncState.PENDING : DatabaseSyncState.SYNCED;
        publishStatus();
    }

    private void markSyncFailed(RuntimeException exception) {
        lastFinishedAt = Instant.now();
        lastError = exception.getMessage();
        state = switch (exception) {
            case SyncDatasetEpochMismatchException ignored -> DatabaseSyncState.REBOOTSTRAP_REQUIRED;
            case SyncServerConflictException ignored -> DatabaseSyncState.CONFLICT;
            default -> DatabaseSyncState.FAILED;
        };
        publishStatus();

        logger.atWarn()
            .addKeyValue("event", "database_sync_batch_failed")
            .setCause(exception)
            .log("Database sync batch failed");
    }

    private void validateDatasetEpoch() {
        if (pullSyncService != null) pullSyncService.validateDatasetEpoch();
    }

    private boolean requiresRebootstrap() {
        return state == DatabaseSyncState.REBOOTSTRAP_REQUIRED;
    }

    public SyncServerRebootstrapService.RebootstrapResult rebootstrap() {
        if (!enabled || rebootstrapService == null) {
            throw new IllegalStateException("sync server rebootstrap is unavailable");
        }
        SyncServerRebootstrapService.RebootstrapResult result = rebootstrapService.rebootstrap();
        pending.set(false);
        state = DatabaseSyncState.SYNCED;
        lastError = null;
        lastSuccessfulSyncAt = Instant.now();
        publishStatus();
        return result;
    }

    private void publishStatus() {
        if (eventHub != null) eventHub.publishDatabaseSyncStatus(status());
    }

    private int pendingConflictCount() {
        return localSyncStateStore == null ? 0 : localSyncStateStore.pendingConflictCount();
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
