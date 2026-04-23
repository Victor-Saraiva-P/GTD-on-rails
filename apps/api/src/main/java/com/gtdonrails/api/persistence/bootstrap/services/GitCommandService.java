package com.gtdonrails.api.persistence.bootstrap.services;

import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

@Service
public class GitCommandService {

    public String statusPorcelain(Path repositoryDirectory) throws IOException, InterruptedException {
        return run(repositoryDirectory, Map.of(), "status", "--porcelain");
    }

    public void addAll(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "add", "-A", ".");
    }

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

    public void pullFastForwardOnly(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "pull", "--ff-only");
    }

    public void push(Path repositoryDirectory) throws IOException, InterruptedException {
        run(repositoryDirectory, Map.of(), "push");
    }

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
        String[] command = new String[arguments.length + 1];
        command[0] = "git";
        System.arraycopy(arguments, 0, command, 1, arguments.length);

        ProcessBuilder processBuilder = new ProcessBuilder(command)
            .directory(workingDirectory.toFile())
            .redirectErrorStream(true);
        processBuilder.environment().putAll(environment);

        Process process = processBuilder.start();
        String output = new String(process.getInputStream().readAllBytes());
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException(output.trim());
        }

        return output.trim();
    }

    public String runRaw(Path workingDirectory, String... arguments) throws IOException, InterruptedException {
        return run(workingDirectory, Map.of(), arguments);
    }

    public String currentBranch(Path repositoryDirectory) throws IOException, InterruptedException {
        return run(repositoryDirectory, Map.of(), "rev-parse", "--abbrev-ref", "HEAD");
    }

    public List<String> logMessages(Path repositoryDirectory) throws IOException, InterruptedException {
        String output = run(repositoryDirectory, Map.of(), "log", "--pretty=%s");
        if (output.isBlank()) {
            return List.of();
        }

        return List.of(output.split("\\R"));
    }
}
