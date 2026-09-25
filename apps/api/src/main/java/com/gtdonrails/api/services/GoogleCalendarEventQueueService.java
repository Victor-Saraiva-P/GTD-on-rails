package com.gtdonrails.api.services;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncState;
import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncStatusDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarEventQueueService {

    private final GoogleCalendarClientGateway client;
    private final boolean enabled;

    @Autowired
    public GoogleCalendarEventQueueService(
        GoogleCalendarClientGateway client,
        @Value("$" + "{gtd.sync.server.enabled:false}") boolean enabled
    ) {
        this.client = client;
        this.enabled = enabled;
    }

    GoogleCalendarEventQueueService(GoogleCalendarClientGateway client) {
        this(client, true);
    }

    /**
     * Google projection is derived from canonical mutations by the sync client.
     *
     * <p>Local domain services keep this hook temporarily so their signatures do not
     * need to change during the migration.</p>
     */
    public void requestUpsert(UUID itemId) {
        // Intentionally empty: sync_outbox -> canonical client state drives Google.
    }

    public void requestDelete(UUID itemId) {
        // Intentionally empty: canonical tombstones drive Google deletion.
    }

    public GoogleCalendarSyncStatusDto status() {
        if (!enabled) {
            return new GoogleCalendarSyncStatusDto(
                GoogleCalendarSyncState.DISABLED,
                false,
                false,
                0,
                null,
                null,
                null,
                null
            );
        }
        try {
            return client.syncStatus();
        } catch (RuntimeException exception) {
            return new GoogleCalendarSyncStatusDto(
                GoogleCalendarSyncState.FAILED,
                false,
                false,
                0,
                null,
                Instant.now(),
                null,
                exception.getMessage()
            );
        }
    }

    void shutdown() {
        // No local worker remains; Google Calendar synchronization belongs to the client.
    }
}
