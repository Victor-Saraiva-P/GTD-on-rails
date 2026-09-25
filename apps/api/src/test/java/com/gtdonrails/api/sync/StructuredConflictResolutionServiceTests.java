package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class StructuredConflictResolutionServiceTests {

    @Mock
    private JdbcTemplate jdbc;
    @Mock
    private SyncServerGateway gateway;
    @Mock
    private LocalSyncStateStore stateStore;
    @Mock
    private RemoteStructuredChangeApplier applier;

    @Test
    void detailCombinesLatestLocalPayloadWithCurrentRemotePayload() throws Exception {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict();
        when(gateway.object("items", "item-1")).thenReturn(remote(false, 5L, "{\"title\":\"remote\"}"));
        stubLocalMutation("UPDATE", "{\"title\":\"local\"}");

        SyncConflictDetail detail = service().detail(conflict);

        assertEquals("{\"title\":\"local\"}", detail.localContent());
        assertEquals("{\"title\":\"remote\"}", detail.remoteContent());
        assertEquals(5L, detail.remoteRevision());
    }

    @Test
    void remoteResolutionSupersedesLocalMutationAndAppliesRemoteObject() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict();
        when(gateway.object("items", "item-1")).thenReturn(remote(false, 5L, "{\"title\":\"remote\"}"));

        service().resolve(conflict, SyncConflictChoice.REMOTE);

        verify(applier).apply(any(SyncRemoteChange.class));
        verify(stateStore).updateRevision("items", "item-1", 5L);
        verify(stateStore).markConflictResolved(7L);
    }

    @Test
    void localResolutionRebasesLatestMutationOnRemoteRevision() throws Exception {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict();
        when(gateway.object("items", "item-1")).thenReturn(remote(false, 5L, "{\"title\":\"remote\"}"));
        stubLocalMutation("UPDATE", "{\"title\":\"local\"}");

        service().resolve(conflict, SyncConflictChoice.LOCAL);

        verify(stateStore).updateRevision("items", "item-1", 5L);
        verify(stateStore).markConflictResolved(7L);
        verify(jdbc).update(
            org.mockito.ArgumentMatchers.contains("insert into sync_outbox"),
            any(),
            eq("items"),
            eq("item-1"),
            eq("UPDATE"),
            eq("{\"title\":\"local\"}")
        );
    }

    @Test
    void mergedChoiceIsRejectedForStructuredMetadata() {
        assertThrows(
            IllegalArgumentException.class,
            () -> service().resolve(conflict(), SyncConflictChoice.MERGED)
        );
    }

    @Test
    void staleRemoteRevisionIsRejected() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict();
        when(gateway.object("items", "item-1")).thenReturn(remote(false, 6L, "{}"));

        assertThrows(IllegalStateException.class, () -> service().detail(conflict));
    }

    @Test
    void localResolutionRequiresAnActiveLocalMutation() {
        LocalSyncStateStore.SyncConflictRecord conflict = conflict();
        when(gateway.object("items", "item-1")).thenReturn(remote(false, 5L, "{}"));
        when(jdbc.query(
            anyString(),
            any(RowMapper.class),
            eq("items"),
            eq("item-1")
        )).thenReturn(List.of());

        assertThrows(
            IllegalStateException.class,
            () -> service().resolve(conflict, SyncConflictChoice.LOCAL)
        );
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubLocalMutation(String operation, String payload) throws Exception {
        when(jdbc.query(
            anyString(),
            any(RowMapper.class),
            eq("items"),
            eq("item-1")
        )).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1);
            ResultSet result = mock(ResultSet.class);
            when(result.getString("operation")).thenReturn(operation);
            when(result.getString("payload")).thenReturn(payload);
            return List.of(mapper.mapRow(result, 0));
        });
    }

    private StructuredConflictResolutionService service() {
        return new StructuredConflictResolutionService(jdbc, gateway, stateStore, applier);
    }

    private LocalSyncStateStore.SyncConflictRecord conflict() {
        return new LocalSyncStateStore.SyncConflictRecord(
            7L, "items", "item-1", "operation-1", 5L, 9L, Instant.EPOCH
        );
    }

    private SyncServerGateway.SyncRemoteObject remote(boolean deleted, long revision, String payload) {
        return new SyncServerGateway.SyncRemoteObject(
            "items", "item-1", revision, payload, null, null, "application/json", deleted
        );
    }
}
