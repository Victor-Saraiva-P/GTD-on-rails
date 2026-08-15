package com.gtdonrails.api.maintenance;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;

public record FlywaySchemaMigration(Flyway flyway, FlywaySchemaRange supportedSchemaRange) implements SchemaMigration {

    @Override
    public boolean isUpgradeable() {
        MigrationInfo current = flyway.info().current();
        if (current == null) return true;
        SchemaCompatibilityStatus status = supportedSchemaRange.evaluate(current.getVersion().getVersion());
        return status == SchemaCompatibilityStatus.COMPATIBLE || status == SchemaCompatibilityStatus.UPGRADEABLE;
    }

    @Override
    public boolean hasPendingMigrations() {
        if (!isUpgradeable()) return false;
        return flyway.info().pending().length > 0;
    }

    @Override
    public void migrate() {
        if (!isUpgradeable()) return;
        flyway.migrate();
    }
}
