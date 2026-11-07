package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GoogleCalendarProjectionQueueTests {

    @TempDir
    Path tempDirectory;

    @Test
    void pendingProjectionSurvivesQueueRestartWhileDisconnected() {
        Path database = tempDirectory.resolve("canonical.db");
        SyncObjectStore objectStore = new SyncObjectStore(database);
        GoogleCalendarMirrorStore mirrorStore = new GoogleCalendarMirrorStore(objectStore);
        GoogleCalendarProjectionService projection = mock(GoogleCalendarProjectionService.class);
        GoogleCalendarCredentialsStore credentials = mock(GoogleCalendarCredentialsStore.class);
        when(credentials.credentialsConfigured()).thenReturn(false);

        GoogleCalendarProjectionQueue queue =
            new GoogleCalendarProjectionQueue(projection, mirrorStore, credentials, "production", true);
        queue.request("item-1");

        assertEquals(1L, queue.status().pendingCount());
        verifyNoInteractions(projection);
        queue.shutdown();

        GoogleCalendarMirrorStore reopened =
            new GoogleCalendarMirrorStore(new SyncObjectStore(database));
        assertEquals(1L, reopened.pendingCount());
    }

    @Test
    void stagingKeepsOutboxWithoutCallingGoogleEvenWithCredentials() {
        SyncObjectStore objectStore = new SyncObjectStore(tempDirectory.resolve("staging.db"));
        GoogleCalendarMirrorStore mirrorStore = new GoogleCalendarMirrorStore(objectStore);
        GoogleCalendarProjectionService projection = mock(GoogleCalendarProjectionService.class);
        GoogleCalendarCredentialsStore credentials = mock(GoogleCalendarCredentialsStore.class);
        when(credentials.credentialsConfigured()).thenReturn(true);
        when(credentials.connected()).thenReturn(true);

        GoogleCalendarProjectionQueue queue =
            new GoogleCalendarProjectionQueue(projection, mirrorStore, credentials, "staging", true);
        queue.request("item-1");
        queue.scheduledSync();

        assertEquals("DISABLED", queue.status().state());
        assertEquals(1L, queue.status().pendingCount());
        verifyNoInteractions(projection);
        queue.shutdown();
    }

    @Test
    void disabledExternalProjectionDoesNotDispatchInProduction() {
        GoogleCalendarProjectionService projection = mock(GoogleCalendarProjectionService.class);
        GoogleCalendarMirrorStore mirrorStore = mock(GoogleCalendarMirrorStore.class);
        GoogleCalendarCredentialsStore credentials = mock(GoogleCalendarCredentialsStore.class);
        GoogleCalendarProjectionQueue queue =
            new GoogleCalendarProjectionQueue(projection, mirrorStore, credentials, "production", false);
        queue.wake();
        assertEquals("DISABLED", queue.status().state());
        verifyNoInteractions(projection);
        queue.shutdown();
    }
}
