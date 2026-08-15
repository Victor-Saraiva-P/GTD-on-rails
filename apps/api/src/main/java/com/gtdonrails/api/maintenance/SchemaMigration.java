package com.gtdonrails.api.maintenance;

public interface SchemaMigration {

    boolean isUpgradeable();

    boolean hasPendingMigrations();

    void migrate();
}
