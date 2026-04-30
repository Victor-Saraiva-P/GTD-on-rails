package com.gtdonrails.api.persistence.bootstrap.services;

import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

@Service
public class GitCommandService {

    /**
     * Returns porcelain status output for a repository.
     *
     * <p>Example: {@code gitCommandService.statusPorcelain(repositoryDirectory)}.</p>
     */
    public String statusPorcelain(Path repositoryDirectory) throws IOException, InterruptedException {
        return run(repositoryDirectory, Map.of(), "status", "--porcelain");
    }

    /**
     * Stages all repository changes for the next commit.
     *
     * <p>Example: {@code gitCommandService.addAll(repositoryDirectory)}.</p>
     */
    public void addAll(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "add", "-A", ".");
    }

    /**
     * Creates a commit with the configured author identity.
     *
     * <p>Example: {@code gitCommandService.commit(repositoryDirectory, message, name, email)}.</p>
     */
    public void commit(
        Path repositoryDirectory,
        String message,
        String authorName,
        String authorEmail
    ) throws IOException, InterruptedException {
        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("GIT_AUTHOR_NAME", authorName);
        environment.put("GIT_AUTHOR_EMAIL", authorEmail);
        environment.put("GIT_COMMITTER_NAME", authorName);
        environment.put("GIT_COMMITTER_EMAIL", authorEmail);
        run(repositoryDirectory, environment, "commit", "-m", message);
    }

    /**
     * Pulls remote changes without creating merge commits.
     *
     * <p>Example: {@code gitCommandService.pullFastForwardOnly(repositoryDirectory)}.</p>
     */
    public void pullFastForwardOnly(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "pull", "--ff-only");
    }

    /**
     * Pushes local commits to the configured upstream.
     *
     * <p>Example: {@code gitCommandService.push(repositoryDirectory)}.</p>
     */
    public void push(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "push");
    }

    /**
     * Clones one branch into a target directory for persistence bootstrap.
     *
     * <p>Example: {@code gitCommandService.cloneBranch(workDir, repoUrl, "main", targetDir)}.</p>
     */
    public void cloneBranch(
        Path workingDirectory,
        String repositoryUrl,
        String branch,
        Path targetDirectory
    ) throws IOException, InterruptedException {
        run(
            workingDirectory,
            Map.of(),
            "clone",
            "--depth",
            "1",
            "--branch",
            branch,
            "--single-branch",
            repositoryUrl,
            targetDirectory.toString()
        );
    }

    protected String run(Path workingDirectory, Map<String, String> environment, String... arguments)
        throws IOException, InterruptedException {
        ProcessBuilder processBuilder = buildProcess(workingDirectory, environment, arguments);
        Process process = processBuilder.start();
        String output = new String(process.getInputStream().readAllBytes());
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException(output.trim());
        }

        return output.trim();
    }

    private ProcessBuilder buildProcess(
        Path workingDirectory,
        Map<String, String> environment,
        String... arguments
    ) {
        String[] command = new String[arguments.length + 1];
        command[0] = "git";
        System.arraycopy(arguments, 0, command, 1, arguments.length);

        ProcessBuilder processBuilder = new ProcessBuilder(command)
            .directory(workingDirectory.toFile())
            .redirectErrorStream(true);
        processBuilder.environment().putAll(environment);
        return processBuilder;
    }

    /**
     * Runs an arbitrary Git command and returns trimmed output.
     *
     * <p>Example: {@code gitCommandService.runRaw(repositoryDirectory, "status")}.</p>
     */
    public String runRaw(Path workingDirectory, String... arguments) throws IOException, InterruptedException {
        return run(workingDirectory, Map.of(), arguments);
    }

    /**
     * Returns the currently checked-out branch name.
     *
     * <p>Example: {@code gitCommandService.currentBranch(repositoryDirectory)}.</p>
     */
    public String currentBranch(Path repositoryDirectory) throws IOException, InterruptedException {
        return run(repositoryDirectory, Map.of(), "rev-parse", "--abbrev-ref", "HEAD");
    }

    /**
     * Returns commit subjects from the repository log.
     *
     * <p>Example: {@code gitCommandService.logMessages(repositoryDirectory)}.</p>
     */
    public List<String> logMessages(Path repositoryDirectory) throws IOException, InterruptedException {
        String output = run(repositoryDirectory, Map.of(), "log", "--pretty=%s");
        if (output.isBlank()) {
            return List.of();
        }

        return List.of(output.split("\\R"));
    }
}
