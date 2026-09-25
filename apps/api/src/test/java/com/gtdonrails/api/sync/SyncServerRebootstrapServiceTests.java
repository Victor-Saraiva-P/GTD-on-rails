package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Consumer;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class SyncServerRebootstrapServiceTests {

    @TempDir
    private Path tempDir;

    @Mock
    private JdbcTemplate jdbc;
    @Mock
    private SyncServerGateway gateway;
    @Mock
    private SyncServerPullService pullService;
    @Mock
    private LocalSyncStateStore stateStore;
    @Mock
    private LocalRecoverySnapshotService recoverySnapshots;
    @Mock
    private CacheInvalidationService cacheInvalidation;
    @Mock
    private TransactionTemplate transactions;
    @Mock
    private TransactionStatus transactionStatus;

    @Test
    void rebootstrapSnapshotsResetsPullsAndEvictsCaches() throws Exception {
        Path recovery = tempDir.resolve("recovery-before-rebootstrap.zip");
        Path itemFile = tempDir.resolve("items/item-1/body.md");
        Path iconFile = tempDir.resolve("assets/contexts/context-1/icon.png");
        Files.createDirectories(itemFile.getParent());
        Files.createDirectories(iconFile.getParent());
        Files.writeString(itemFile, "local");
        Files.write(iconFile, new byte[] {1, 2, 3});

        when(recoverySnapshots.create()).thenReturn(recovery);
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("new-epoch", 12L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("new-epoch", 12L));
        executeTransactionsImmediately();

        SyncServerRebootstrapService.RebootstrapResult result = service().rebootstrap();

        assertEquals("recovery-before-rebootstrap.zip", result.recoverySnapshot());
        assertEquals("new-epoch", result.datasetEpoch());
        assertEquals(12L, result.cursor());
        assertFalse(Files.exists(tempDir.resolve("items")));
        assertFalse(Files.exists(tempDir.resolve("assets/contexts")));

        verify(stateStore).updateClientState("new-epoch", 0L);
        verify(pullService).pullAll();
        verify(cacheInvalidation).evictAll();
        verify(jdbc).update("delete from next_action_contexts");
        verify(jdbc).update("delete from sync_conflicts");
    }

    @Test
    void rebootstrapAlsoWorksWhenPhysicalContentDoesNotExist() {
        Path recovery = tempDir.resolve("empty-recovery.zip");
        when(recoverySnapshots.create()).thenReturn(recovery);
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 0L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("epoch", 0L));
        executeTransactionsImmediately();

        SyncServerRebootstrapService.RebootstrapResult result = service().rebootstrap();

        assertEquals(0L, result.cursor());
        verify(pullService).pullAll();
    }

    @SuppressWarnings("unchecked")
    private void executeTransactionsImmediately() {
        org.mockito.Mockito.doAnswer(invocation -> {
            Consumer<TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(transactionStatus);
            return null;
        }).when(transactions).executeWithoutResult(any());
    }

    private SyncServerRebootstrapService service() {
        return new SyncServerRebootstrapService(
            jdbc,
            gateway,
            pullService,
            stateStore,
            recoverySnapshots,
            cacheInvalidation,
            transactions,
            tempDir.toString()
        );
    }
}
