package com.gtdonrails.api.persistence.bootstrap;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PersistenceGitSyncService {

    private static final Logger logger = LoggerFactory.getLogger(PersistenceGitSyncService.class);

    private final PersistenceBootstrapProperties persistenceBootstrapProperties;
    private final PersistenceSyncProperties persistenceSyncProperties;
    private final GitCommandService gitCommandService;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

    private volatile Path repositoryDirectory;
    private volatile Path databasePath;
    private volatile PersistenceSyncState state;
    private volatile Instant lastStartedAt;
    private volatile Instant lastFinishedAt;
    private volatile Instant lastSuccessfulSyncAt;
    private volatile String lastError;

    public PersistenceGitSyncService(
        PersistenceBootstrapProperties persistenceBootstrapProperties,
        PersistenceSyncProperties persistenceSyncProperties,
        GitCommandService gitCommandService
    ) {
        this.persistenceBootstrapProperties = persistenceBootstrapProperties;
        this.persistenceSyncProperties = persistenceSyncProperties;
        this.gitCommandService = gitCommandService;
        this.state = persistenceSyncProperties.isEnabled() ? PersistenceSyncState.IDLE : PersistenceSyncState.DISABLED;
    }

    public void initialize(String jdbcUrl) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            repositoryDirectory = null;
            databasePath = null;
            return;
        }

        Path resolvedDatabasePath = resolveSqlitePath(jdbcUrl);
        Path resolvedRepositoryDirectory = Path.of(persistenceBootstrapProperties.getCloneDirectory()).toAbsolutePath().normalize();

        if (!resolvedDatabasePath.startsWith(resolvedRepositoryDirectory)) {
            throw new IllegalStateException("Datasource path must point inside the configured clone directory");
        }

        if (!Files.exists(resolvedRepositoryDirectory)) {
            throw new IllegalStateException("Persistence clone directory does not exist: " + resolvedRepositoryDirectory);
        }

        if (!Files.exists(resolvedDatabasePath)) {
            throw new IllegalStateException("Persistence database file does not exist: " + resolvedDatabasePath);
        }

        repositoryDirectory = resolvedRepositoryDirectory;
        databasePath = resolvedDatabasePath;
    }

    public void pullOnStartup() {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        try {
            pullNow("startup");
        } catch (RuntimeException exception) {
            logger.warn("Initial persistence Git pull failed", exception);
        }
    }

    @Scheduled(fixedDelayString = "${gtd.persistence.sync.interval-ms:300000}")
    public void requestScheduledPull() {
        requestPull("scheduled");
    }

    public void requestSync(String reason, PersistenceChangeType changeType) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        executorService.submit(() -> syncNow(reason, changeType));
    }

    public void requestPull(String reason) {
        if (!persistenceSyncProperties.isEnabled()) {
            state = PersistenceSyncState.DISABLED;
            return;
        }

        executorService.submit(() -> pullNow(reason));
    }

    public PersistenceSyncStatus status() {
        return new PersistenceSyncStatus(state, lastStartedAt, lastFinishedAt, lastSuccessfulSyncAt, lastError);
    }

    void syncNow(String reason, PersistenceChangeType changeType) {
        runTask(reason, () -> {
            Path repository = requiredRepositoryDirectory();
            if (gitCommandService.statusPorcelain(repository).isBlank()) {
                logger.debug("Skipping persistence Git sync because repository is clean ({})", reason);
                return;
            }

            gitCommandService.addAll(repository);
            gitCommandService.commit(
                repository,
                changeType.commitMessage(),
                persistenceSyncProperties.getCommitAuthorName(),
                persistenceSyncProperties.getCommitAuthorEmail()
            );
            gitCommandService.pullFastForwardOnly(repository);
            gitCommandService.push(repository);
        });
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

    private void runTask(String reason, GitTask task) {
        lastStartedAt = Instant.now();
        state = PersistenceSyncState.SYNCING;
        logger.info("Starting persistence Git sync ({})", reason);

        try {
            task.run();
            lastSuccessfulSyncAt = Instant.now();
            lastError = null;
            state = PersistenceSyncState.IDLE;
        } catch (IllegalStateException | IOException exception) {
            lastError = exception.getMessage();
            state = PersistenceSyncState.FAILED;
            logger.warn("Persistence Git sync failed ({})", reason, exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            lastError = exception.getMessage();
            state = PersistenceSyncState.FAILED;
            logger.warn("Persistence Git sync interrupted ({})", reason, exception);
        } finally {
            lastFinishedAt = Instant.now();
        }
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

    private Path resolveSqlitePath(String jdbcUrl) {
        if (jdbcUrl == null || !jdbcUrl.startsWith("jdbc:sqlite:")) {
            throw new IllegalArgumentException("Only jdbc:sqlite URLs are supported");
        }

        String pathPart = jdbcUrl.substring("jdbc:sqlite:".length());
        if (pathPart.startsWith("file:")) {
            pathPart = pathPart.substring("file:".length());
        }

        int queryIndex = pathPart.indexOf('?');
        if (queryIndex >= 0) {
            pathPart = pathPart.substring(0, queryIndex);
        }

        return Path.of(pathPart).toAbsolutePath().normalize();
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
