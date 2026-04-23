package com.gtdonrails.api.persistence.bootstrap;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GitPersistenceBootstrapService {

    private static final Logger logger = LoggerFactory.getLogger(GitPersistenceBootstrapService.class);

    private final PersistenceBootstrapProperties persistenceBootstrapProperties;
    private final GitCommandService gitCommandService;

    public GitPersistenceBootstrapService(
        PersistenceBootstrapProperties persistenceBootstrapProperties,
        GitCommandService gitCommandService
    ) {
        this.persistenceBootstrapProperties = persistenceBootstrapProperties;
        this.gitCommandService = gitCommandService;
    }

    public void ensureDatabaseAvailable(String jdbcUrl) {
        Path databasePath = resolveSqlitePath(jdbcUrl);
        if (Files.exists(databasePath) || !persistenceBootstrapProperties.isEnabled()) {
            return;
        }

        if (!StringUtils.hasText(persistenceBootstrapProperties.getRepositoryUrl())) {
            throw new IllegalStateException("Missing gtd.persistence.bootstrap.repository-url");
        }

        if (!StringUtils.hasText(persistenceBootstrapProperties.getBranch())) {
            throw new IllegalStateException("Missing gtd.persistence.bootstrap.branch");
        }

        if (!StringUtils.hasText(persistenceBootstrapProperties.getCloneDirectory())) {
            throw new IllegalStateException("Missing gtd.persistence.bootstrap.clone-directory");
        }

        try {
            cloneRepositoryIfNeeded(databasePath);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to bootstrap SQLite database from Git repository", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Failed to bootstrap SQLite database from Git repository", exception);
        }
    }

    Path resolveSqlitePath(String jdbcUrl) {
        if (!StringUtils.hasText(jdbcUrl) || !jdbcUrl.startsWith("jdbc:sqlite:")) {
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

    private void cloneRepositoryIfNeeded(Path databasePath) throws IOException, InterruptedException {
        Path cloneDirectory = Path.of(persistenceBootstrapProperties.getCloneDirectory()).toAbsolutePath().normalize();
        if (!databasePath.startsWith(cloneDirectory)) {
            throw new IllegalStateException("Datasource path must point inside the configured clone directory");
        }

        if (Files.exists(cloneDirectory)) {
            if (Files.exists(databasePath)) {
                return;
            }

            throw new IllegalStateException("Clone directory already exists but database file is missing: " + cloneDirectory);
        }

        Path parentDirectory = cloneDirectory.getParent();
        if (parentDirectory != null) {
            Files.createDirectories(parentDirectory);
        }

        Path tempCloneDirectory = cloneDirectory.resolveSibling(
            cloneDirectory.getFileName() + ".tmp-" + UUID.randomUUID());

        try {
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

            logger.info("Bootstrapping SQLite database from branch '{}'", persistenceBootstrapProperties.getBranch());
            Files.move(tempCloneDirectory, cloneDirectory, StandardCopyOption.ATOMIC_MOVE);

            if (!Files.exists(databasePath)) {
                throw new IllegalStateException("Database file not found in cloned repository: " + databasePath);
            }
        } finally {
            deleteRecursively(tempCloneDirectory);
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

        try (var stream = Files.walk(directory)) {
            stream.sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException exception) {
                        throw new IllegalStateException("Failed to clean temporary bootstrap directory", exception);
                    }
                });
        }
    }
}
