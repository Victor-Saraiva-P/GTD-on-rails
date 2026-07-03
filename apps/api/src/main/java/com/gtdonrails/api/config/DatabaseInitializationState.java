package com.gtdonrails.api.config;

import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializationState {

    private boolean createdEmptyDatabase;

    /**
     * Records that startup created a new SQLite database file.
     *
     * <p>Example: {@code databaseInitializationState.markCreatedEmptyDatabase()}.</p>
     */
    public void markCreatedEmptyDatabase() {
        createdEmptyDatabase = true;
    }

    /**
     * Reports whether startup created a new SQLite database file.
     *
     * <p>Example: {@code databaseInitializationState.createdEmptyDatabase()}.</p>
     */
    public boolean createdEmptyDatabase() {
        return createdEmptyDatabase;
    }
}
