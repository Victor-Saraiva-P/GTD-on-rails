package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncState;
import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncStatusDto;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class GoogleCalendarEventQueueServiceTests {

    @Test
    void localMutationHooksDoNotContactGoogleClientDirectly() {
        GoogleCalendarClientGateway client = mock(GoogleCalendarClientGateway.class);
        GoogleCalendarEventQueueService service = new GoogleCalendarEventQueueService(client);

        service.requestUpsert(UUID.randomUUID());
        service.requestDelete(UUID.randomUUID());

        verify(client, never()).reconcile();
    }

    @Test
    void statusComesFromSyncClient() {
        GoogleCalendarClientGateway client = mock(GoogleCalendarClientGateway.class);
        GoogleCalendarSyncStatusDto remote = new GoogleCalendarSyncStatusDto(
            GoogleCalendarSyncState.PENDING,
            true,
            false,
            2,
            null,
            null,
            null,
            null
        );
        when(client.syncStatus()).thenReturn(remote);
        GoogleCalendarEventQueueService service = new GoogleCalendarEventQueueService(client);

        assertEquals(remote, service.status());
    }

    @Test
    void unavailableClientReportsFailedStatusWithoutLocalWorker() {
        GoogleCalendarClientGateway client = mock(GoogleCalendarClientGateway.class);
        when(client.syncStatus()).thenThrow(new IllegalStateException("client offline"));
        GoogleCalendarEventQueueService service = new GoogleCalendarEventQueueService(client);

        GoogleCalendarSyncStatusDto status = service.status();

        assertEquals(GoogleCalendarSyncState.FAILED, status.state());
        assertEquals(false, status.pending());
        assertEquals(false, status.running());
        assertEquals("client offline", status.lastError());
        assertEquals(Instant.class, status.lastFinishedAt().getClass());
    }
}
