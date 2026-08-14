package com.gtdonrails.api.maintenance;

import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;

@Configuration
@Profile("prod")
public class BackupMigrationConfiguration {

    @Bean
    FlywayMigrationStrategy backupBeforeFlyway(PostgresBackupService backupService) {
        return flyway -> migrateAfterBackup(flyway, backupService);
    }

    private void migrateAfterBackup(Flyway flyway, PostgresBackupService backupService) {
        if (hasPendingMigrations(flyway)) backupService.createPreMigrationBackup();
        flyway.migrate();
    }

    private boolean hasPendingMigrations(Flyway flyway) {
        return flyway.info().pending().length > 0;
    }
}
