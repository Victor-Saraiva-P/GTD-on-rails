package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("integration")
class GitPersistenceBootstrapServiceTests {

    @TempDir
    Path tempDir;

    @Test
    void clonesDevBranchWhenDatabaseIsMissing() throws Exception {
        Path repository = createPersistenceRepository();
        Path cloneDirectory = tempDir.resolve("runtime/gtd-persistence-dev");
        Path databasePath = cloneDirectory.resolve("db/gtd-on-rails.db");

        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setRepositoryUrl(repository.toString());
        properties.setBranch("dev");
        properties.setCloneDirectory(cloneDirectory.toString());

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService());
        service.ensureDatabaseAvailable("jdbc:sqlite:" + databasePath);

        assertTrue(Files.exists(databasePath));
        assertTrue(Files.exists(cloneDirectory.resolve(".git")));
        assertEquals("dev", Files.readString(databasePath));
    }

    @Test
    void clonesTestsBranchWhenDatabaseIsMissing() throws Exception {
        Path repository = createPersistenceRepository();
        Path cloneDirectory = tempDir.resolve("runtime/gtd-persistence-test");
        Path databasePath = cloneDirectory.resolve("db/gtd-on-rails.db");

        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setRepositoryUrl(repository.toString());
        properties.setBranch("tests");
        properties.setCloneDirectory(cloneDirectory.toString());

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService());
        service.ensureDatabaseAvailable("jdbc:sqlite:" + databasePath);

        assertTrue(Files.exists(databasePath));
        assertTrue(Files.exists(cloneDirectory.resolve(".git")));
        assertEquals("tests", Files.readString(databasePath));
    }

    private Path createPersistenceRepository() throws Exception {
        Path repository = tempDir.resolve("gtd-persistence");
        Files.createDirectories(repository.resolve("db"));

        runGit(repository, "init", "-b", "main");
        runGit(repository, "config", "user.name", "Codex Test");
        runGit(repository, "config", "user.email", "codex@example.com");

        Files.writeString(repository.resolve("db/gtd-on-rails.db"), "main");
        runGit(repository, "add", "db/gtd-on-rails.db");
        runGit(repository, "commit", "-m", "main db");

        runGit(repository, "checkout", "-b", "dev");
        Files.writeString(repository.resolve("db/gtd-on-rails.db"), "dev");
        runGit(repository, "commit", "-am", "dev db");

        runGit(repository, "checkout", "main");
        runGit(repository, "checkout", "-b", "tests");
        Files.writeString(repository.resolve("db/gtd-on-rails.db"), "tests");
        runGit(repository, "commit", "-am", "tests db");

        runGit(repository, "checkout", "main");
        return repository;
    }

    private void runGit(Path workingDirectory, String... arguments) throws IOException, InterruptedException {
        String[] command = new String[arguments.length + 1];
        command[0] = "git";
        System.arraycopy(arguments, 0, command, 1, arguments.length);

        Process process = new ProcessBuilder(command)
            .directory(workingDirectory.toFile())
            .redirectErrorStream(true)
            .start();

        String output = new String(process.getInputStream().readAllBytes());
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException(output.trim());
        }
    }
}
