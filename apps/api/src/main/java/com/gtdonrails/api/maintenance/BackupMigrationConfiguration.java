package com.gtdonrails.api.maintenance;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;

@Configuration
@Profile("prod")
public class BackupMigrationConfiguration {

    @Bean
    FlywayMigrationStrategy backupBeforeFlyway(
        PostgresBackupService backupService,
        FlywaySchemaRange supportedSchemaRange
    ) {
        BackupMigrationGate migrationGate = new BackupMigrationGate(backupService);
        return flyway -> migrationGate.migrate(new FlywaySchemaMigration(flyway, supportedSchemaRange));
    }
}
