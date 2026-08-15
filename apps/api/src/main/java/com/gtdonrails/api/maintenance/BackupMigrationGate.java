package com.gtdonrails.api.maintenance;

final class BackupMigrationGate {

    private final PostgresBackupService backupService;

    BackupMigrationGate(PostgresBackupService backupService) {
        this.backupService = backupService;
    }

    void migrate(SchemaMigration schemaMigration) {
        if (!schemaMigration.isUpgradeable()) return;
        if (schemaMigration.hasPendingMigrations()) backupService.createPreMigrationBackup();
        schemaMigration.migrate();
    }
}
