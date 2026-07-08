package com.gtdonrails.api.services;

import com.gtdonrails.api.config.DatabaseInitializationState;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NewDatabaseDataSyncPublisher {

    private final DatabaseInitializationState databaseInitializationState;
    private final DataSyncService dataSyncService;

    public NewDatabaseDataSyncPublisher(DatabaseInitializationState databaseInitializationState, DataSyncService dataSyncService) {
        this.databaseInitializationState = databaseInitializationState;
        this.dataSyncService = dataSyncService;
    }

    /**
     * Queues data sync after Flyway initializes a newly created database.
     *
     * <p>Example: {@code publishNewDatabaseSync(event)}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void publishNewDatabaseSync() {
        if (!databaseInitializationState.createdEmptyDatabase()) return;

        dataSyncService.requestSync("new database initialized");
    }
}
