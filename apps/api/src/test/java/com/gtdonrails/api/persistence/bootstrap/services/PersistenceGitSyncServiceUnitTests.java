package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncState;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceSyncProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class PersistenceGitSyncServiceUnitTests {

    @TempDir
    Path tempDir;

    @Test
    void syncDoesNotCommitWhenRepositoryIsClean() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        gitCommandService.statusOutput = "";

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        assertEquals(List.of("statusPorcelain"), gitCommandService.commands);
        assertEquals(PersistenceSyncState.IDLE, service.status().state());
        assertNotNull(service.status().lastSuccessfulSyncAt());
    }

    @Test
    void syncRunsAddCommitPullAndPushInOrder() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        gitCommandService.statusOutput = " M db/gtd-on-rails.db";

        service.syncNow("manual", PersistenceChangeType.UPDATE_CONTEXT);

        assertEquals(
            List.of("statusPorcelain", "addAll", "commit", "pullFastForwardOnly", "push"),
            gitCommandService.commands);
        assertEquals("feat(data): update context", gitCommandService.commitMessage);
        assertEquals("GTD on Rails", gitCommandService.authorName);
        assertEquals("gtdonrails@local", gitCommandService.authorEmail);
        assertEquals(PersistenceSyncState.IDLE, service.status().state());
    }

    @Test
    void syncMarksFailureWhenPullFails() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        gitCommandService.statusOutput = " M db/gtd-on-rails.db";
        gitCommandService.pullFailure = new IllegalStateException("pull failed");

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        assertEquals(PersistenceSyncState.FAILED, service.status().state());
        assertEquals("pull failed", service.status().lastError());
    }

    @Test
    void syncMarksFailureWhenPushFails() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        gitCommandService.statusOutput = " M db/gtd-on-rails.db";
        gitCommandService.pushFailure = new IllegalStateException("push failed");

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        assertEquals(PersistenceSyncState.FAILED, service.status().state());
        assertEquals("push failed", service.status().lastError());
    }

    @Test
    void scheduledPullOnlyRunsPull() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        service.pullNow("scheduled");

        assertEquals(List.of("pullFastForwardOnly"), gitCommandService.commands);
    }

    @Test
    void pullOnStartupRunsPullWhenSyncIsEnabled() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, true);

        service.pullOnStartup();

        assertEquals(List.of("pullFastForwardOnly"), gitCommandService.commands);
    }

    @Test
    void pullOnStartupDoesNothingWhenSyncIsDisabled() throws Exception {
        FakeGitCommandService gitCommandService = new FakeGitCommandService();
        PersistenceGitSyncService service = createService(gitCommandService, false);

        service.pullOnStartup();

        assertEquals(List.of(), gitCommandService.commands);
        assertEquals(PersistenceSyncState.DISABLED, service.status().state());
    }

    private PersistenceGitSyncService createService(GitCommandService gitCommandService, boolean enabled) throws Exception {
        Path databasePath = createRuntimeDatabase();
        PersistenceBootstrapProperties bootstrapProperties = new PersistenceBootstrapProperties();
        bootstrapProperties.setCloneDirectory(databasePath.getParent().getParent().toString());

        PersistenceSyncProperties syncProperties = new PersistenceSyncProperties();
        syncProperties.setEnabled(enabled);
        PersistenceGitSyncService service = new PersistenceGitSyncService(
            bootstrapProperties,
            syncProperties,
            gitCommandService,
            new SqliteJdbcUrlResolver()
        );
        service.initialize("jdbc:sqlite:" + databasePath);
        return service;
    }

    private Path createRuntimeDatabase() throws Exception {
        Path databasePath = tempDir.resolve("gtd-persistence/db/gtd-on-rails.db");
        Files.createDirectories(databasePath.getParent());
        Files.writeString(databasePath, "seed");
        return databasePath;
    }

    private static class FakeGitCommandService extends GitCommandService {

        private final List<String> commands = new ArrayList<>();
        private String statusOutput = "";
        private String commitMessage;
        private String authorName;
        private String authorEmail;
        private RuntimeException pullFailure;
        private RuntimeException pushFailure;

        @Override
        public String statusPorcelain(Path repositoryDirectory) {
            commands.add("statusPorcelain");
            return statusOutput;
        }

        @Override
        public void addAll(Path repositoryDirectory) {
            commands.add("addAll");
        }

        @Override
        public void commit(Path repositoryDirectory, String message, String authorName, String authorEmail) {
            commands.add("commit");
            commitMessage = message;
            this.authorName = authorName;
            this.authorEmail = authorEmail;
        }

        @Override
        public void pullFastForwardOnly(Path repositoryDirectory) {
            commands.add("pullFastForwardOnly");
            if (pullFailure != null) {
                throw pullFailure;
            }
        }

        @Override
        public void push(Path repositoryDirectory) {
            commands.add("push");
            if (pushFailure != null) {
                throw pushFailure;
            }
        }
    }
}
