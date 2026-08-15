package com.gtdonrails.api.maintenance;

import org.flywaydb.core.Flyway;

record FlywaySchemaMigration(Flyway flyway) implements SchemaMigration {

    @Override
    public boolean hasPendingMigrations() {
        return flyway.info().pending().length > 0;
    }

    @Override
    public void migrate() {
        flyway.migrate();
    }
}
