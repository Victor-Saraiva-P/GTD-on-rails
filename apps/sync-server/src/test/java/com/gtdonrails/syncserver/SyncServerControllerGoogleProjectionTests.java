package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class SyncServerControllerGoogleProjectionTests {

    @Test
    void canonicalCalendarMutationRequestsGoogleProjection() {
        SyncObjectStore store = mock(SyncObjectStore.class);
        GoogleCalendarProjectionQueue queue = mock(GoogleCalendarProjectionQueue.class);
        SyncServerController controller = new SyncServerController(store, queue);
        SyncMutation mutation = mutation("calendars", "item-1");
        SyncMutationResult result = new SyncMutationResult(1L, 2L);
        when(store.apply(mutation)).thenReturn(result);

        assertEquals(result, controller.mutate(mutation));

        verify(queue).wake();
    }

    @Test
    void unrelatedCanonicalMutationDoesNotRequestGoogleProjection() {
        SyncObjectStore store = mock(SyncObjectStore.class);
        GoogleCalendarProjectionQueue queue = mock(GoogleCalendarProjectionQueue.class);
        SyncServerController controller = new SyncServerController(store, queue);
        SyncMutation mutation = mutation("contexts", "context-1");
        when(store.apply(mutation)).thenReturn(new SyncMutationResult(1L, 2L));

        controller.mutate(mutation);

        verify(queue, never()).wake();
    }

    private SyncMutation mutation(String type, String id) {
        return new SyncMutation(
            UUID.randomUUID(),
            type,
            id,
            0L,
            "UPSERT",
            "{}",
            null,
            null,
            "application/json"
        );
    }
}
