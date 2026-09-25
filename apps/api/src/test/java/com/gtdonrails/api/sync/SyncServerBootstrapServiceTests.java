package com.gtdonrails.api.sync;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
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
class SyncServerBootstrapServiceTests {

    @TempDir
    private Path tempDir;

    @Mock
    private JdbcTemplate jdbc;
    @Mock
    private SyncServerGateway gateway;
    @Mock
    private LocalSyncStateStore stateStore;
    @Mock
    private TransactionTemplate transactions;
    @Mock
    private TransactionStatus transactionStatus;

    @Test
    void skipsBootstrapWhenClientAlreadyHasDatasetEpoch() {
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState("epoch", 3L));

        service().initializeIfNeeded();

        verify(gateway, never()).state();
    }

    @Test
    void recordsEpochWithoutUploadingWhenServerAlreadyHasCanonicalData() {
        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState(null, 0L));
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("remote-epoch", 12L));
        executeTransactionsImmediately();

        service().initializeIfNeeded();

        verify(stateStore).updateClientState("remote-epoch", 0L);
        verify(jdbc, never()).queryForList(anyString());
    }

    @Test
    void emptyServerQueuesStructuredRowsAndExistingBodyDocuments() throws Exception {
        Path body = tempDir.resolve("items/item-1/body.md");
        Files.createDirectories(body.getParent());
        Files.writeString(body, "# local");

        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState(null, 0L));
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("remote-epoch", 0L));
        executeTransactionsImmediately();

        when(jdbc.queryForList(anyString())).thenReturn(List.of());
        when(jdbc.queryForList("select * from items")).thenReturn(List.of(Map.of(
            "id", "item-1",
            "title", "Local item",
            "body", "legacy body"
        )));
        when(jdbc.queryForList("select id from items", String.class)).thenReturn(List.of("item-1"));

        service().initializeIfNeeded();

        verify(stateStore).updateClientState("remote-epoch", 0L);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("update sync_outbox"));
        verify(jdbc).update(
            org.mockito.ArgumentMatchers.contains("insert into sync_file_outbox"),
            any(),
            org.mockito.ArgumentMatchers.eq("body_document"),
            org.mockito.ArgumentMatchers.eq("item-1"),
            org.mockito.ArgumentMatchers.eq("items/item-1/body.md"),
            org.mockito.ArgumentMatchers.eq("text/markdown")
        );
    }

    @SuppressWarnings("unchecked")
    private void executeTransactionsImmediately() {
        org.mockito.Mockito.doAnswer(invocation -> {
            Consumer<TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(transactionStatus);
            return null;
        }).when(transactions).executeWithoutResult(any());
    }

    private SyncServerBootstrapService service() {
        return new SyncServerBootstrapService(
            jdbc,
            new ObjectMapper(),
            gateway,
            stateStore,
            transactions,
            tempDir.toString()
        );
    }
}
