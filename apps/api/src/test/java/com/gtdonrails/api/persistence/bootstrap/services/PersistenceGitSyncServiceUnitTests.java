package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceSyncState;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceSyncProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.mockito.Mockito;

@Tag("unit")
class PersistenceGitSyncServiceUnitTests {

    @TempDir
    Path tempDir;

    @Test
    void syncDoesNotCommitWhenRepositoryIsClean() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        when(gitCommandService.statusPorcelain(service.repositoryDirectory())).thenReturn("");

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        verify(gitCommandService).statusPorcelain(service.repositoryDirectory());
        verify(gitCommandService, never()).addAll(any());
        verify(gitCommandService, never()).commit(any(), any(), any(), any());
        verify(gitCommandService, never()).pullFastForwardOnly(any());
        verify(gitCommandService, never()).push(any());
        assertEquals(PersistenceSyncState.IDLE, service.status().state());
        assertNotNull(service.status().lastSuccessfulSyncAt());
    }

    @Test
    void syncRunsAddCommitPullAndPushInOrder() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        when(gitCommandService.statusPorcelain(service.repositoryDirectory())).thenReturn(" M db/gtd-on-rails.db");

        service.syncNow("manual", PersistenceChangeType.UPDATE_CONTEXT);

        InOrder inOrder = inOrder(gitCommandService);
        verifySyncCommandOrder(service, gitCommandService, inOrder);
        assertEquals(PersistenceSyncState.IDLE, service.status().state());
    }

    private void verifySyncCommandOrder(
        PersistenceGitSyncService service,
        GitCommandService gitCommandService,
        InOrder inOrder
    ) throws Exception {
        inOrder.verify(gitCommandService).statusPorcelain(service.repositoryDirectory());
        inOrder.verify(gitCommandService).addAll(service.repositoryDirectory());
        inOrder.verify(gitCommandService).commit(
            service.repositoryDirectory(),
            "feat(data): update context",
            "GTD on Rails",
            "gtdonrails@local"
        );
        inOrder.verify(gitCommandService).pullFastForwardOnly(service.repositoryDirectory());
        inOrder.verify(gitCommandService).push(service.repositoryDirectory());
    }

    @Test
    void syncMarksFailureWhenPullFails() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        when(gitCommandService.statusPorcelain(service.repositoryDirectory())).thenReturn(" M db/gtd-on-rails.db");
        doThrow(new IllegalStateException("pull failed")).when(gitCommandService).pullFastForwardOnly(service.repositoryDirectory());

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        assertEquals(PersistenceSyncState.FAILED, service.status().state());
        assertEquals("pull failed", service.status().lastError());
    }

    @Test
    void syncMarksFailureWhenPushFails() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        when(gitCommandService.statusPorcelain(service.repositoryDirectory())).thenReturn(" M db/gtd-on-rails.db");
        doThrow(new IllegalStateException("push failed")).when(gitCommandService).push(service.repositoryDirectory());

        service.syncNow("manual", PersistenceChangeType.UPDATE_ITEM);

        assertEquals(PersistenceSyncState.FAILED, service.status().state());
        assertEquals("push failed", service.status().lastError());
    }

    @Test
    void scheduledPullOnlyRunsPull() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        service.pullNow("scheduled");

        verify(gitCommandService).pullFastForwardOnly(service.repositoryDirectory());
        verify(gitCommandService, never()).statusPorcelain(any());
        verify(gitCommandService, never()).addAll(any());
        verify(gitCommandService, never()).commit(any(), any(), any(), any());
        verify(gitCommandService, never()).push(any());
    }

    @Test
    void pullOnStartupRunsPullWhenSyncIsEnabled() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, true);

        service.pullOnStartup();

        verify(gitCommandService).pullFastForwardOnly(service.repositoryDirectory());
    }

    @Test
    void pullOnStartupDoesNothingWhenSyncIsDisabled() throws Exception {
        GitCommandService gitCommandService = Mockito.mock(GitCommandService.class);
        PersistenceGitSyncService service = createService(gitCommandService, false);

        service.pullOnStartup();

        verify(gitCommandService, never()).pullFastForwardOnly(any());
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
}
