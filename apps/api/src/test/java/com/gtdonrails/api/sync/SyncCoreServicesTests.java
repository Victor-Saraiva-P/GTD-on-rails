package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class SyncCoreServicesTests {

    @Mock
    private SyncServerGateway gateway;
    @Mock
    private LocalSyncStateStore stateStore;
    @Mock
    private RemoteSyncChangeApplier applier;
    @Mock
    private FileConflictResolutionService fileConflicts;
    @Mock
    private StructuredConflictResolutionService structuredConflicts;
    @Mock
    private TransactionTemplate transactions;
    @Mock
    private TransactionStatus transactionStatus;

    @Test
    void pushUpdatesRevisionAfterSuccessfulMutation() {
        SyncOutboxEvent event = event();
        when(stateStore.revision("items", "item-1")).thenReturn(4L);
        when(gateway.push(event, 4L)).thenReturn(new SyncServerGateway.SyncPushResult(5L, 12L));

        new SyncServerPushService(gateway, stateStore).pushEvent(event);

        verify(stateStore).updateRevision("items", "item-1", 5L);
    }

    @Test
    void pushRecordsConflictAtCurrentRemoteCursorAndRethrows() {
        SyncOutboxEvent event = event();
        SyncServerConflictException conflict = new SyncServerConflictException("stale", 9L);
        when(stateStore.revision("items", "item-1")).thenReturn(4L);
        when(gateway.push(event, 4L)).thenThrow(conflict);
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 33L));

        SyncServerConflictException thrown = assertThrows(
            SyncServerConflictException.class,
            () -> new SyncServerPushService(gateway, stateStore).pushEvent(event)
        );

        assertEquals(conflict, thrown);
        verify(stateStore).recordConflict(new SyncRemoteChange(
            33L, "items", "item-1", 9L, "UPSERT", null, null, null, null
        ));
    }

    @Test
    void pullAppliesFreshStructuredChangesAndAdvancesCursor() {
        SyncRemoteChange change = change("items", 2L);
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 7L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("epoch", 1L));
        when(gateway.changesAfter(1L, 200))
            .thenReturn(new SyncServerGateway.SyncPullPage(7L, List.of(change)));
        when(stateStore.revision("items", "item-1")).thenReturn(1L);
        when(stateStore.hasPendingMutation("items", "item-1")).thenReturn(false);
        executeTransactionsImmediately();

        pullService().pullAll();

        verify(applier).apply(change);
        verify(stateStore).updateRevision("items", "item-1", 2L);
        verify(stateStore).updateClientState("epoch", 7L);
    }

    @Test
    void pullRecordsStructuredConflictWhenLocalMutationIsPending() {
        SyncRemoteChange change = change("items", 2L);
        prepareOnePage(change);
        when(stateStore.hasPendingMutation("items", "item-1")).thenReturn(true);
        when(applier.supportsFile("items")).thenReturn(false);

        pullService().pullAll();

        verify(stateStore).recordConflict(change);
        verify(applier, never()).apply(change);
    }

    @Test
    void pullDelegatesFileConflictWhenLocalFileMutationIsPending() {
        SyncRemoteChange change = change("body_document", 2L);
        prepareOnePage(change);
        when(stateStore.hasPendingMutation("body_document", "item-1")).thenReturn(true);
        when(applier.supportsFile("body_document")).thenReturn(true);

        pullService().pullAll();

        verify(fileConflicts).resolvePullConflict(change);
        verify(applier, never()).apply(change);
    }

    @Test
    void pullIgnoresAlreadyAppliedRevision() {
        SyncRemoteChange change = change("items", 2L);
        prepareOnePage(change);
        when(stateStore.revision("items", "item-1")).thenReturn(2L);

        pullService().pullAll();

        verify(applier, never()).apply(change);
        verify(stateStore, never()).recordConflict(change);
    }

    @Test
    void pullRejectsDatasetEpochMismatch() {
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("remote", 0L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("local", 0L));

        assertThrows(SyncDatasetEpochMismatchException.class, () -> pullService().validateDatasetEpoch());
    }

    @Test
    void emptyLocalEpochAcceptsRemoteEpoch() {
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("remote", 0L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState(null, 0L));

        pullService().validateDatasetEpoch();
    }

    @Test
    void conflictServiceRoutesFileAndStructuredDetails() {
        LocalSyncStateStore.SyncConflictRecord file = conflict(1L, "body_document");
        LocalSyncStateStore.SyncConflictRecord structured = conflict(2L, "items");
        SyncConflictDetail fileDetail = new SyncConflictDetail(1L, "body_document", "item-1", 2L, Instant.EPOCH, true, null, "l", "r");
        SyncConflictDetail structuredDetail = new SyncConflictDetail(2L, "items", "item-1", 2L, Instant.EPOCH, false, null, "l", "r");
        when(stateStore.pendingConflict(1L)).thenReturn(Optional.of(file));
        when(stateStore.pendingConflict(2L)).thenReturn(Optional.of(structured));
        when(fileConflicts.detail(file)).thenReturn(fileDetail);
        when(structuredConflicts.detail(structured)).thenReturn(structuredDetail);
        SyncConflictService service = conflictService();

        assertEquals(fileDetail, service.detail(1L));
        assertEquals(structuredDetail, service.detail(2L));
    }

    @Test
    void conflictServiceRoutesResolutionAndRejectsUnknownId() {
        LocalSyncStateStore.SyncConflictRecord file = conflict(1L, "item_asset_file");
        LocalSyncStateStore.SyncConflictRecord structured = conflict(2L, "items");
        when(stateStore.pendingConflict(1L)).thenReturn(Optional.of(file));
        when(stateStore.pendingConflict(2L)).thenReturn(Optional.of(structured));
        when(stateStore.pendingConflict(99L)).thenReturn(Optional.empty());
        SyncConflictService service = conflictService();

        service.resolve(1L, SyncConflictChoice.LOCAL, null);
        service.resolve(2L, SyncConflictChoice.REMOTE, null);

        verify(fileConflicts).resolvePendingConflict(file, SyncConflictChoice.LOCAL, null);
        verify(structuredConflicts).resolve(structured, SyncConflictChoice.REMOTE);
        assertThrows(IllegalArgumentException.class, () -> service.detail(99L));
    }

    @Test
    void conflictServiceReturnsPendingConflicts() {
        List<LocalSyncStateStore.SyncConflictRecord> conflicts = List.of(conflict(1L, "items"));
        when(stateStore.pendingConflicts()).thenReturn(conflicts);

        assertEquals(conflicts, conflictService().pending());
    }

    private SyncServerPullService pullService() {
        return new SyncServerPullService(gateway, stateStore, applier, fileConflicts, transactions);
    }

    private SyncConflictService conflictService() {
        return new SyncConflictService(stateStore, fileConflicts, structuredConflicts);
    }

    private void prepareOnePage(SyncRemoteChange change) {
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("epoch", 2L));
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("epoch", 1L));
        when(gateway.changesAfter(1L, 200))
            .thenReturn(new SyncServerGateway.SyncPullPage(2L, List.of(change)));
        when(stateStore.revision(change.objectType(), change.objectId())).thenReturn(0L);
        executeTransactionsImmediately();
    }

    @SuppressWarnings("unchecked")
    private void executeTransactionsImmediately() {
        when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<Long> callback = invocation.getArgument(0);
            return callback.doInTransaction(transactionStatus);
        });
    }

    private SyncOutboxEvent event() {
        return new SyncOutboxEvent("items", "item-1", SyncOutboxOperation.UPDATE, "{\"id\":\"item-1\"}");
    }

    private SyncRemoteChange change(String type, long revision) {
        return new SyncRemoteChange(2L, type, "item-1", revision, "UPSERT", "{}", null, null, null);
    }

    private LocalSyncStateStore.SyncConflictRecord conflict(long id, String type) {
        return new LocalSyncStateStore.SyncConflictRecord(
            id, type, "item-1", "operation-1", 2L, 3L, Instant.EPOCH
        );
    }
}
