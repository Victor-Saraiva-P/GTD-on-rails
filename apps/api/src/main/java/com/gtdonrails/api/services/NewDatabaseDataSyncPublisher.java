package com.gtdonrails.api.services;

import com.gtdonrails.api.config.DatabaseInitializationState;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NewDatabaseDataSyncPublisher {

    private final DatabaseInitializationState databaseInitializationState;
    private final FileSyncService fileSyncService;

    public NewDatabaseDataSyncPublisher(DatabaseInitializationState databaseInitializationState, FileSyncService fileSyncService) {
        this.databaseInitializationState = databaseInitializationState;
        this.fileSyncService = fileSyncService;
    }

    /**
     * Queues File Sync after Flyway initializes a newly created database.
     *
     * <p>Example: {@code publishNewDatabaseSync(event)}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void publishNewDatabaseSync() {
        if (!databaseInitializationState.createdEmptyDatabase()) return;

        fileSyncService.requestSync("new database initialized");
    }
}
