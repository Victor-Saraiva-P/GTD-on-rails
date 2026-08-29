package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import com.gtdonrails.api.dtos.sync.DatabaseSyncState;
import com.gtdonrails.api.dtos.sync.DatabaseSyncStatusDto;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import com.gtdonrails.api.entities.SyncOutboxStatus;
import com.gtdonrails.api.repositories.SyncOutboxRepository;
import org.junit.jupiter.api.Test;

class DatabaseSyncServiceTests {

    @Test
    void reportsDisabledStatusWhenDatabaseSyncIsDisabled() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, false);
        DatabaseSyncStatusDto status = service.status();

        assertEquals(DatabaseSyncState.DISABLED, status.state());
        assertEquals(0, status.pendingCount());
        assertFalse(status.pending());
        assertFalse(status.running());
        assertFalse(service.hasPendingEvents());
    }

    @Test
    void reportsSyncedStatusWhenNoEventsPending() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        when(outboxRepository.countByStatus(SyncOutboxStatus.PENDING)).thenReturn(0);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, true);
        DatabaseSyncStatusDto status = service.status();

        assertEquals(DatabaseSyncState.SYNCED, status.state());
        assertEquals(0, status.pendingCount());
        assertFalse(service.hasPendingEvents());
    }

    @Test
    void reportsPendingStatusWhenEventsAreWaiting() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        when(outboxRepository.countByStatus(SyncOutboxStatus.PENDING)).thenReturn(3);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, true);
        DatabaseSyncStatusDto status = service.status();

        assertEquals(3, status.pendingCount());
        assertTrue(service.hasPendingEvents());
    }

    @Test
    void pushesPendingEventsToSupabase() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);

        SyncOutboxEvent event = new SyncOutboxEvent("items", "item-123", SyncOutboxOperation.INSERT, "{\"id\":\"item-123\"}");
        when(outboxRepository.findByStatusOrderByCreatedAtAsc(SyncOutboxStatus.PENDING))
            .thenReturn(List.of(event));

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, true);
        service.pushSingleEvent(event);

        verify(pushSyncService).pushEvent(event);
        assertEquals(SyncOutboxStatus.COMPLETED, event.getStatus());
        verify(outboxRepository, times(2)).save(event);
    }

    @Test
    void handlesEventPushFailureAndResetsToPending() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);

        SyncOutboxEvent event = new SyncOutboxEvent("items", "item-123", SyncOutboxOperation.INSERT, "{\"id\":\"item-123\"}");
        doThrow(new RuntimeException("Connection timeout")).when(pushSyncService).pushEvent(any());

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, true);
        service.pushSingleEvent(event);

        assertEquals(SyncOutboxStatus.PENDING, event.getStatus());
        assertEquals(1, event.getRetryCount());
        assertEquals("Connection timeout", event.getLastError());
    }

    @Test
    void syncOnStartupPushesEventsAndPullsFromSupabase() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);
        SupabasePullSyncService pullSyncService = mock(SupabasePullSyncService.class);

        when(outboxRepository.findByStatusOrderByCreatedAtAsc(SyncOutboxStatus.PENDING)).thenReturn(List.of());

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, pullSyncService, true);
        service.syncOnStartup();

        verify(pullSyncService).pullAll();
        assertEquals(DatabaseSyncState.SYNCED, service.status().state());
    }

    @Test
    void syncOnStartupHandlesFailureGracefully() {
        SyncOutboxRepository outboxRepository = mock(SyncOutboxRepository.class);
        SupabasePushSyncService pushSyncService = mock(SupabasePushSyncService.class);
        SupabasePullSyncService pullSyncService = mock(SupabasePullSyncService.class);

        when(outboxRepository.findByStatusOrderByCreatedAtAsc(SyncOutboxStatus.PENDING)).thenReturn(List.of());
        doThrow(new RuntimeException("Supabase unreachable")).when(pullSyncService).pullAll();

        DatabaseSyncService service = new DatabaseSyncService(outboxRepository, pushSyncService, pullSyncService, true);
        service.syncOnStartup();

        assertEquals(DatabaseSyncState.FAILED, service.status().state());
        assertEquals("Supabase unreachable", service.status().lastError());
    }
}
