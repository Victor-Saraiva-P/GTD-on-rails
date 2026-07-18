package com.gtdonrails.api.services;

import com.gtdonrails.api.config.DatabaseInitializationState;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NewDatabaseFileSyncPublisher {

    private final DatabaseInitializationState databaseInitializationState;
    private final FileSyncService fileSyncService;

    public NewDatabaseFileSyncPublisher(DatabaseInitializationState databaseInitializationState, FileSyncService fileSyncService) {
        this.databaseInitializationState = databaseInitializationState;
        this.fileSyncService = fileSyncService;
    }

    /**
     * Queues File Sync after Flyway initializes a newly created database.
     *
     * <p>Example: {@code publishNewDatabaseFileSync()}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void publishNewDatabaseFileSync() {
        if (!databaseInitializationState.createdEmptyDatabase()) return;

        fileSyncService.requestSync("new database initialized");
    }
}
