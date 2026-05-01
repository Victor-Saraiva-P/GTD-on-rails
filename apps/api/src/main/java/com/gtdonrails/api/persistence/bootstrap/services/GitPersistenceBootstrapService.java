package com.gtdonrails.api.persistence.bootstrap.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;

import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GitPersistenceBootstrapService {

    private static final Logger logger = LoggerFactory.getLogger(GitPersistenceBootstrapService.class);

    private final PersistenceBootstrapProperties persistenceBootstrapProperties;
    private final GitCommandService gitCommandService;
    private final SqliteJdbcUrlResolver sqliteJdbcUrlResolver;

    public GitPersistenceBootstrapService(
        PersistenceBootstrapProperties persistenceBootstrapProperties,
        GitCommandService gitCommandService,
        SqliteJdbcUrlResolver sqliteJdbcUrlResolver
    ) {
        this.persistenceBootstrapProperties = persistenceBootstrapProperties;
        this.gitCommandService = gitCommandService;
        this.sqliteJdbcUrlResolver = sqliteJdbcUrlResolver;
    }

    /**
     * Clones the persistence repository when the configured SQLite database is missing.
     *
     * <p>Example: {@code gitPersistenceBootstrapService.ensureDatabaseAvailable(jdbcUrl)}.</p>
     */
    public void ensureDatabaseAvailable(String jdbcUrl) {
        Path databasePath = sqliteJdbcUrlResolver.resolve(jdbcUrl);
        if (Files.exists(databasePath) || !persistenceBootstrapProperties.isEnabled()) {
            return;
        }

        requireBootstrapConfiguration();
        cloneRepositoryOrThrow(databasePath);
    }

    private void cloneRepositoryOrThrow(Path databasePath) {
        try {
            cloneRepositoryIfNeeded(databasePath);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to bootstrap SQLite database from Git repository", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Failed to bootstrap SQLite database from Git repository", exception);
        }
    }

    private void requireBootstrapConfiguration() {
        requireText(persistenceBootstrapProperties.getRepositoryUrl(), "gtd.persistence.bootstrap.repository-url");
        requireText(persistenceBootstrapProperties.getBranch(), "gtd.persistence.bootstrap.branch");
        requireText(persistenceBootstrapProperties.getCloneDirectory(), "gtd.persistence.bootstrap.clone-directory");
    }

    private void requireText(String value, String propertyName) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Missing " + propertyName);
        }
    }

    private void cloneRepositoryIfNeeded(Path databasePath) throws IOException, InterruptedException {
        Path cloneDirectory = Path.of(persistenceBootstrapProperties.getCloneDirectory()).toAbsolutePath().normalize();
        requireDatabaseInsideClone(databasePath, cloneDirectory);
        if (cloneDirectoryHasDatabase(databasePath, cloneDirectory)) {
            return;
        }

        Path parentDirectory = ensureParentDirectory(cloneDirectory);
        Path tempCloneDirectory = cloneDirectory.resolveSibling(
            cloneDirectory.getFileName() + ".tmp-" + UUID.randomUUID());

        try {
            cloneBranch(parentDirectory, tempCloneDirectory);
            moveCloneIntoPlace(tempCloneDirectory, cloneDirectory, databasePath);
        } finally {
            deleteRecursively(tempCloneDirectory);
        }
    }

    private void requireDatabaseInsideClone(Path databasePath, Path cloneDirectory) {
        if (!databasePath.startsWith(cloneDirectory)) {
            throw new IllegalStateException("Datasource path must point inside the configured clone directory");
        }
    }

    private boolean cloneDirectoryHasDatabase(Path databasePath, Path cloneDirectory) {
        if (!Files.exists(cloneDirectory)) {
            return false;
        }

        if (!Files.exists(databasePath)) {
            throw new IllegalStateException("Clone directory already exists but database file is missing: " + cloneDirectory);
        }

        return true;
    }

    private Path ensureParentDirectory(Path cloneDirectory) throws IOException {
        Path parentDirectory = cloneDirectory.getParent();
        if (parentDirectory != null) {
            Files.createDirectories(parentDirectory);
        }

        return parentDirectory;
    }

    private void cloneBranch(Path parentDirectory, Path tempCloneDirectory) throws IOException, InterruptedException {
        try {
            gitCommandService.cloneBranch(
                parentDirectory != null ? parentDirectory : Path.of(".").toAbsolutePath().normalize(),
                persistenceBootstrapProperties.getRepositoryUrl(),
                persistenceBootstrapProperties.getBranch(),
                tempCloneDirectory
            );
        } catch (IllegalStateException exception) {
            throw buildGitFailure(exception.getMessage());
        }
    }

    private void moveCloneIntoPlace(Path tempCloneDirectory, Path cloneDirectory, Path databasePath) throws IOException {
        logger.atInfo()
            .addKeyValue("event", "persistence_bootstrap_started")
            .addKeyValue("branch", persistenceBootstrapProperties.getBranch())
            .addKeyValue("clone_directory", cloneDirectory)
            .log("Bootstrapping SQLite database");
        Files.move(tempCloneDirectory, cloneDirectory, StandardCopyOption.ATOMIC_MOVE);

        if (!Files.exists(databasePath)) {
            throw new IllegalStateException("Database file not found in cloned repository: " + databasePath);
        }
    }

    IllegalStateException buildGitFailure(String output) {
        String repositoryUrl = persistenceBootstrapProperties.getRepositoryUrl();

        if (output.contains("Repository not found")
            || output.contains("Authentication failed")
            || output.contains("could not read Username")
            || output.contains("Permission denied")
            || output.contains("could not resolve host")) {
            return new IllegalStateException(
                "Unable to clone persistence repository '"
                    + repositoryUrl
                    + "'. This application assumes the host machine already has non-interactive Git access to that repository. "
                    + "Configure local Git credentials or use a repository URL accessible from this environment. Git output: "
                    + output);
        }

        return new IllegalStateException("Git command failed while bootstrapping persistence repository: " + output);
    }

    private void deleteRecursively(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }

        try (Stream<Path> stream = Files.walk(directory)) {
            stream.sorted(Comparator.reverseOrder())
                .forEach(this::deleteTemporaryPath);
        }
    }

    private void deleteTemporaryPath(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to clean temporary bootstrap directory", exception);
        }
    }
}
