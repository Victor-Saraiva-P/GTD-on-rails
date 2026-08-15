package com.gtdonrails.api.maintenance;

interface SchemaMigration {

    boolean hasPendingMigrations();

    void migrate();
}
