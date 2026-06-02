package com.gtdonrails.api.persistence.bootstrap.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncState;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncStatus;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceSyncProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PersistenceGitSyncService {

    private static final Logger logger = LoggerFactory.getLogger(PersistenceGitSyncService.class);
    private static final long BLOCKING_SYNC_TIMEOUT_SECONDS = 30L;

    private final PersistenceBootstrapProperties persistenceBootstrapProperties;
    private final PersistenceSyncProperties persistenceSyncProperties;
    private final GitCommandService gitCommandService;
    private final SqliteJdbcUrlResolver sqliteJdbcUrlResolver;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

    private volatile Path repositoryDirectory;
    private volatile Path databasePath;
    private volatile PersistenceSyncState state;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;
    private volatile boolean hasLocalChanges;
    private volatile boolean hasUnpushedCommits;

    public PersistenceGitSyncService(
        PersistenceBootstrapProperties persistenceBootstrapProperties,
        PersistenceSyncProperties persistenceSyncProperties,
        GitCommandService gitCommandService,
        SqliteJdbcUrlResolver sqliteJdbcUrlResolver
    ) {
        this.persistenceBootstrapProperties = persistenceBootstrapProperties;
        this.persistenceSyncProperties = persistenceSyncProperties;
        this.gitCommandService = gitCommandService;
        this.sqliteJdbcUrlResolver = sqliteJdbcUrlResolver;
        this.state = persistenceSyncProperties.isEnabled() ? PersistenceSyncState.IDLE : PersistenceSyncState.DISABLED;
    }

    /**
     * Captures repository and database paths required before persistence sync can run.
     *
     * <p>Example: {@code persistenceGitSyncService.initialize(jdbcUrl)}.</p>
     */
    public void initialize(String jdbcUrl) {
        if (!persistenceSyncProperties.isEnabled()) {
            disableSync();
            return;
        }

        Path resolvedDatabasePath = sqliteJdbcUrlResolver.resolve(jdbcUrl);
        Path resolvedRepositoryDirectory = Path.of(persistenceBootstrapProperties.getCloneDirectory()).toAbsolutePath().normalize();

        requireInitializedPaths(resolvedDatabasePath, resolvedRepositoryDirectory);
        repositoryDirectory = resolvedRepositoryDirectory;
        databasePath = resolvedDatabasePath;
    }

    private void disableSync() {
        state = PersistenceSyncState.DISABLED;
        repositoryDirectory = null;
        databasePath = null;
    }

    private void requireInitializedPaths(Path resolvedDatabasePath, Path resolvedRepositoryDirectory) {
        if (!resolvedDatabasePath.startsWith(resolvedRepositoryDirectory)) {
            throw new IllegalStateException("Datasource path must point inside the configured clone directory");
        }

        requirePathExists(resolvedRepositoryDirectory, "Persistence clone directory does not exist: ");
        requirePathExists(resolvedDatabasePath, "Persistence database file does not exist: ");
    }

    private void requirePathExists(Path path, String messagePrefix) {
        if (!Files.exists(path)) {
            throw new IllegalStateException(messagePrefix + path);
        }
    }

    /**
     * Performs the startup pull and leaves later recovery to scheduled sync.
     *
     * <p>Example: {@code persistenceGitSyncService.pullOnStartup()}.</p>
     */
    public void pullOnStartup() {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        try {
            pullNow("startup");
        } catch (RuntimeException exception) {
            logger.atWarn()
                .addKeyValue("event", "initial_persistence_git_pull_failed")
                .addKeyValue("reason", "startup")
                .setCause(exception)
                .log("Initial persistence Git pull failed");
        }
    }

    /**
     * Queues the periodic persistence pull requested by the scheduler.
     *
     * <p>Example: {@code persistenceGitSyncService.requestScheduledPull()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.persistence.sync.interval-ms:300000}")
    public void requestScheduledPull() {
        requestPull("scheduled");
    }

    /**
     * Queues a commit, pull, and push for local persistence changes.
     *
     * <p>Example: {@code persistenceGitSyncService.requestSync("item updated", PersistenceChangeType.UPDATE_ITEM)}.</p>
     */
    public void requestSync(String reason, PersistenceChangeType changeType) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        executorService.submit(() -> syncNow(reason, changeType));
    }

    /**
     * Runs commit, pull, and push before returning to the caller.
     *
     * <p>Example: {@code syncService.syncBlocking("credentials", UPDATE_INTEGRATION_CREDENTIALS)}.</p>
     */
    public void syncBlocking(String reason, PersistenceChangeType changeType) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        RuntimeException failure = runBlockingTask(reason, () -> syncRepository(reason, changeType));
        if (failure != null) throw failure;
    }

    private RuntimeException runBlockingTask(String reason, GitTask task) {
        ExecutorService blockingExecutor = Executors.newSingleThreadExecutor();
        try {
            Future<RuntimeException> future = blockingExecutor.submit(() -> runTask(reason, task));
            return future.get(BLOCKING_SYNC_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException exception) {
            markBlockingSyncTimedOut(reason);
            return new IllegalStateException("Persistence Git sync timed out after 30 seconds", exception);
        } catch (Exception exception) {
            return runtimeFailure(exception);
        } finally {
            blockingExecutor.shutdownNow();
        }
    }

    private void markBlockingSyncTimedOut(String reason) {
        lastFinishedAt = Instant.now();
        lastError = "Persistence Git sync timed out after 30 seconds";
        state = PersistenceSyncState.FAILED;
        logger.atWarn()
            .addKeyValue("event", "persistence_git_sync_timed_out")
            .addKeyValue("reason", reason)
            .log("Persistence Git sync timed out");
    }

    /**
     * Queues a pull-only persistence sync for remote changes.
     *
     * <p>Example: {@code persistenceGitSyncService.requestPull("manual")}.</p>
     */
    public void requestPull(String reason) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        executorService.submit(() -> pullNow(reason));
    }

    /**
     * Returns the latest persistence sync state for status endpoints.
     *
     * <p>Example: {@code persistenceGitSyncService.status()}.</p>
     */
    public PersistenceSyncStatus status() {
        return new PersistenceSyncStatus(
            state,
            lastStartedAt,
            lastFinishedAt,
            lastSuccessfulSyncAt,
            lastError,
            hasLocalChanges,
            hasUnpushedCommits
        );
    }

    void syncNow(String reason, PersistenceChangeType changeType) {
        runTask(reason, () -> syncRepository(reason, changeType));
    }

    private void syncRepository(String reason, PersistenceChangeType changeType) throws IOException, InterruptedException {
        Path repository = requiredRepositoryDirectory();
        hasLocalChanges = !gitCommandService.statusPorcelain(repository).isBlank();
        hasUnpushedCommits = gitCommandService.hasUnpushedCommits(repository);
        if (!hasLocalChanges) {
            finishCleanRepositorySync(repository, reason);
            return;
        }

        commitAndPushLocalChanges(repository, changeType);
    }

    private void commitAndPushLocalChanges(Path repository, PersistenceChangeType changeType) throws IOException, InterruptedException {
        gitCommandService.addAll(repository);
        gitCommandService.commit(
            repository,
            changeType.commitMessage(),
            persistenceSyncProperties.getCommitAuthorName(),
            persistenceSyncProperties.getCommitAuthorEmail()
        );
        hasLocalChanges = false;
        hasUnpushedCommits = true;
        gitCommandService.pullFastForwardOnly(repository);
        gitCommandService.push(repository);
        hasUnpushedCommits = false;
    }

    private void finishCleanRepositorySync(Path repository, String reason) throws IOException, InterruptedException {
        if (hasUnpushedCommits) {
            pushPendingCommits(repository, reason);
            return;
        }

        logger.atDebug()
            .addKeyValue("event", "persistence_git_sync_skipped")
            .addKeyValue("reason", reason)
            .addKeyValue("repository", repository)
            .log("Skipping persistence Git sync because repository is clean");
    }

    private void pushPendingCommits(Path repository, String reason) throws IOException, InterruptedException {
        if (!hasUnpushedCommits) {
            return;
        }

        logger.atInfo()
            .addKeyValue("event", "persistence_git_push_retry")
            .addKeyValue("reason", reason)
            .addKeyValue("repository", repository)
            .log("Retrying pending persistence Git push");
        gitCommandService.push(repository);
        hasUnpushedCommits = false;
    }

    void pullNow(String reason) {
        runTask(reason, () -> gitCommandService.pullFastForwardOnly(requiredRepositoryDirectory()));
    }

    Path repositoryDirectory() {
        return repositoryDirectory;
    }

    Path databasePath() {
        return databasePath;
    }

    private RuntimeException runTask(String reason, GitTask task) {
        lastStartedAt = Instant.now();
        state = PersistenceSyncState.SYNCING;
        logger.atInfo()
            .addKeyValue("event", "persistence_git_sync_started")
            .addKeyValue("reason", reason)
            .log("Starting persistence Git sync");

        try {
            task.run();
            markTaskSucceeded();
            return null;
        } catch (IllegalStateException | IOException exception) {
            markTaskFailed(exception);
            logger.atWarn()
                .addKeyValue("event", "persistence_git_sync_failed")
                .addKeyValue("reason", reason)
                .setCause(exception)
                .log("Persistence Git sync failed");
            return runtimeFailure(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            markTaskFailed(exception);
            logger.atWarn()
                .addKeyValue("event", "persistence_git_sync_interrupted")
                .addKeyValue("reason", reason)
                .setCause(exception)
                .log("Persistence Git sync interrupted");
            return new IllegalStateException("Persistence Git sync was interrupted", exception);
        } finally {
            lastFinishedAt = Instant.now();
        }
    }

    private RuntimeException runtimeFailure(Exception exception) {
        if (exception instanceof RuntimeException runtimeException) return runtimeException;
        return new IllegalStateException(exception.getMessage(), exception);
    }

    private void markTaskSucceeded() {
        lastSuccessfulSyncAt = Instant.now();
        lastError = null;
        state = PersistenceSyncState.IDLE;
    }

    private void markTaskFailed(Exception exception) {
        lastError = exception.getMessage();
        state = PersistenceSyncState.FAILED;
    }

    private Path requiredRepositoryDirectory() {
        if (repositoryDirectory == null || databasePath == null) {
            throw new IllegalStateException("Persistence Git sync service was not initialized");
        }

        if (!Files.exists(repositoryDirectory)) {
            throw new IllegalStateException("Persistence clone directory does not exist: " + repositoryDirectory);
        }

        if (!Files.exists(databasePath)) {
            throw new IllegalStateException("Persistence database file does not exist: " + databasePath);
        }

        return repositoryDirectory;
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }

    @FunctionalInterface
    private interface GitTask {
        void run() throws IOException, InterruptedException;
    }
}
