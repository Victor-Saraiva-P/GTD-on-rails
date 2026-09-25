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

    @Test
    void emptyServerQueuesNextActionContextsAndBinaryFiles() throws Exception {
        Path asset = tempDir.resolve("items/item-1/assets/asset-1/report.pdf");
        Path icon = tempDir.resolve("assets/contexts/context-1/icon-1/icon.png");
        Files.createDirectories(asset.getParent());
        Files.createDirectories(icon.getParent());
        Files.write(asset, new byte[] {1, 2});
        Files.write(icon, new byte[] {3, 4});

        when(stateStore.clientState()).thenReturn(new LocalSyncStateStore.SyncClientState(null, 0L));
        when(gateway.state()).thenReturn(new SyncServerGateway.SyncRemoteState("remote-epoch", 0L));
        executeTransactionsImmediately();

        when(jdbc.queryForList(anyString())).thenReturn(List.of());
        when(jdbc.queryForList("select * from next_actions")).thenReturn(List.of(Map.of(
            "item_id", "item-1",
            "energy", "HIGH"
        )));
        when(jdbc.queryForList(
            "select context_id from next_action_contexts where next_action_id = ? order by context_id",
            String.class,
            "item-1"
        )).thenReturn(List.of("context-1"));
        Map<String, Object> assetRow = Map.of(
            "id", "asset-1",
            "item_id", "item-1",
            "file_name", "report.pdf",
            "content_type", "application/pdf"
        );
        Map<String, Object> iconRow = Map.of(
            "id", "icon-1",
            "context_id", "context-1",
            "file_name", "icon.png",
            "content_type", "image/png"
        );
        when(jdbc.queryForList("select * from item_assets")).thenReturn(List.of(assetRow));
        when(jdbc.queryForList("select * from context_icon_assets")).thenReturn(List.of(iconRow));
        when(jdbc.queryForList("select id, item_id, file_name, content_type from item_assets"))
            .thenReturn(List.of(assetRow));
        when(jdbc.queryForList("select id, context_id, file_name, content_type from context_icon_assets"))
            .thenReturn(List.of(iconRow));
        when(jdbc.queryForList("select id from items", String.class)).thenReturn(List.of());

        service().initializeIfNeeded();

        verify(jdbc).update(
            org.mockito.ArgumentMatchers.contains("insert into sync_file_outbox"),
            any(),
            org.mockito.ArgumentMatchers.eq("item_asset_file"),
            org.mockito.ArgumentMatchers.eq("asset-1"),
            org.mockito.ArgumentMatchers.eq("items/item-1/assets/asset-1/report.pdf"),
            org.mockito.ArgumentMatchers.eq("application/pdf")
        );
        verify(jdbc).update(
            org.mockito.ArgumentMatchers.contains("insert into sync_file_outbox"),
            any(),
            org.mockito.ArgumentMatchers.eq("context_icon_file"),
            org.mockito.ArgumentMatchers.eq("icon-1"),
            org.mockito.ArgumentMatchers.eq("assets/contexts/context-1/icon-1/icon.png"),
            org.mockito.ArgumentMatchers.eq("image/png")
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
