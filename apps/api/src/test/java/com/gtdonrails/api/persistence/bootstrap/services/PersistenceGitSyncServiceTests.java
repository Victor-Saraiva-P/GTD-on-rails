package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncState;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncStatus;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceSyncProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("integration")
class PersistenceGitSyncServiceTests {

    @TempDir
    Path tempDir;

    @Test
    void syncCreatesCommitAndPushesToRemote() throws Exception {
        Path remoteRepository = createBareRepository("remote.git");
        RuntimePersistence runtimePersistence = bootstrapRuntimePersistence(remoteRepository);
        PersistenceGitSyncService syncService = createSyncService(
            runtimePersistence.bootstrapProperties(),
            runtimePersistence.databasePath()
        );

        Files.writeString(runtimePersistence.databasePath(), "changed locally");
        syncService.requestSync("item updated", PersistenceChangeType.UPDATE_ITEM);
        waitForIdle(syncService);

        assertEquals(PersistenceSyncState.IDLE, syncService.status().state());
        List<String> localLogMessages = new GitCommandService().logMessages(runtimePersistence.cloneDirectory());
        assertEquals(List.of("feat(data): update item", "seed dev"), localLogMessages.subList(0, 2));
        assertRemoteDatabaseContent(remoteRepository, "changed locally");
    }

    @Test
    void scheduledPullBringsRemoteChangesWhenCloneIsClean() throws Exception {
        Path remoteRepository = createBareRepository("remote.git");
        RuntimePersistence runtimePersistence = bootstrapRuntimePersistence(remoteRepository);
        PersistenceGitSyncService syncService = createSyncService(
            runtimePersistence.bootstrapProperties(),
            runtimePersistence.databasePath()
        );

        commitRemoteDatabaseChange(remoteRepository, "updated remotely");

        syncService.requestPull("scheduled");
        waitForIdle(syncService);

        assertEquals("updated remotely", Files.readString(runtimePersistence.databasePath()));
        List<String> pulledLogMessages = new GitCommandService().logMessages(runtimePersistence.cloneDirectory());
        assertEquals(List.of("remote update", "seed dev"), pulledLogMessages.subList(0, 2));
    }

    private RuntimePersistence bootstrapRuntimePersistence(Path remoteRepository) throws Exception {
        seedRemoteRepository(remoteRepository, "dev", "initial");
        Path cloneDirectory = tempDir.resolve("runtime/gtd-persistence");
        Path databasePath = cloneDirectory.resolve("db/gtd-on-rails.db");
        PersistenceBootstrapProperties properties = bootstrapProperties(remoteRepository, cloneDirectory);

        GitPersistenceBootstrapService bootstrapService = new GitPersistenceBootstrapService(
            properties,
            new GitCommandService(),
            new SqliteJdbcUrlResolver()
        );
        bootstrapService.ensureDatabaseAvailable("jdbc:sqlite:" + databasePath);
        return new RuntimePersistence(properties, cloneDirectory, databasePath);
    }

    private PersistenceBootstrapProperties bootstrapProperties(Path remoteRepository, Path cloneDirectory) {
        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setRepositoryUrl(remoteRepository.toString());
        properties.setBranch("dev");
        properties.setCloneDirectory(cloneDirectory.toString());
        return properties;
    }

    private void commitRemoteDatabaseChange(Path remoteRepository, String content) throws Exception {
        Path writerClone = tempDir.resolve("writer");
        runGit(tempDir, "clone", "--branch", "dev", remoteRepository.toString(), writerClone.toString());
        Files.writeString(writerClone.resolve("db/gtd-on-rails.db"), content);
        runGit(writerClone, "config", "user.name", "Codex Test");
        runGit(writerClone, "config", "user.email", "codex@example.com");
        runGit(writerClone, "commit", "-am", "remote update");
        runGit(writerClone, "push", "origin", "dev");
    }

    private void assertRemoteDatabaseContent(Path remoteRepository, String expectedContent) throws Exception {
        Path verificationClone = tempDir.resolve("verification");
        runGit(tempDir, "clone", "--branch", "dev", remoteRepository.toString(), verificationClone.toString());
        assertEquals(expectedContent, Files.readString(verificationClone.resolve("db/gtd-on-rails.db")));
        List<String> remoteLogMessages = new GitCommandService().logMessages(verificationClone);
        assertEquals(List.of("feat(data): update item", "seed dev"), remoteLogMessages.subList(0, 2));
    }

    private PersistenceGitSyncService createSyncService(
        PersistenceBootstrapProperties bootstrapProperties,
        Path databasePath
    ) {
        PersistenceSyncProperties syncProperties = new PersistenceSyncProperties();
        syncProperties.setEnabled(true);

        PersistenceGitSyncService syncService = new PersistenceGitSyncService(
            bootstrapProperties,
            syncProperties,
            new GitCommandService(),
            new SqliteJdbcUrlResolver()
        );
        syncService.initialize("jdbc:sqlite:" + databasePath);
        return syncService;
    }

    private void waitForIdle(PersistenceGitSyncService syncService) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Instant.now().isBefore(deadline)) {
            PersistenceSyncStatus status = syncService.status();
            if ((status.state() == PersistenceSyncState.IDLE || status.state() == PersistenceSyncState.FAILED)
                && status.lastFinishedAt() != null) {
                return;
            }
            Thread.sleep(50L);
        }

        throw new IllegalStateException("Timed out waiting for persistence Git sync to finish");
    }

    private Path createBareRepository(String name) throws IOException, InterruptedException {
        Path repository = tempDir.resolve(name);
        runGit(tempDir, "init", "--bare", repository.toString());
        return repository;
    }

    private void seedRemoteRepository(Path remoteRepository, String branch, String contents) throws Exception {
        Path seedRepository = tempDir.resolve("seed-" + branch);
        Files.createDirectories(seedRepository.resolve("db"));

        runGit(seedRepository, "init", "-b", "main");
        runGit(seedRepository, "config", "user.name", "Codex Test");
        runGit(seedRepository, "config", "user.email", "codex@example.com");
        runGit(seedRepository, "remote", "add", "origin", remoteRepository.toString());

        Files.writeString(seedRepository.resolve("db/gtd-on-rails.db"), "main");
        runGit(seedRepository, "add", "db/gtd-on-rails.db");
        runGit(seedRepository, "commit", "-m", "seed main");
        runGit(seedRepository, "push", "-u", "origin", "main");

        runGit(seedRepository, "checkout", "-b", branch);
        Files.writeString(seedRepository.resolve("db/gtd-on-rails.db"), contents);
        runGit(seedRepository, "commit", "-am", "seed " + branch);
        runGit(seedRepository, "push", "-u", "origin", branch);
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

    private record RuntimePersistence(
        PersistenceBootstrapProperties bootstrapProperties,
        Path cloneDirectory,
        Path databasePath
    ) {
    }
}
