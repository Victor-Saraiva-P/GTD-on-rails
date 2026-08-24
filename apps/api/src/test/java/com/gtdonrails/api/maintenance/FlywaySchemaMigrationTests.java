package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationFilter;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.output.InfoResult;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;

class FlywaySchemaMigrationTests {

    @Test
    void reportsWhetherFlywayHasPendingMigrations() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertTrue(new FlywaySchemaMigration(new FakeFlyway(1, "1"), range).hasPendingMigrations());
        assertFalse(new FlywaySchemaMigration(new FakeFlyway(0, "2"), range).hasPendingMigrations());
    }

    @Test
    void delegatesMigrationToFlywayWhenUpgradeable() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);
        FakeFlyway flyway = new FakeFlyway(1, "1");

        FlywaySchemaMigration migration = new FlywaySchemaMigration(flyway, range);
        assertTrue(migration.isUpgradeable());
        migration.migrate();

        assertTrue(flyway.migrated);
    }

    @Test
    void refusesMigrationWhenSchemaVersionIsNewerThanSupported() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);
        FakeFlyway flyway = new FakeFlyway(0, "3");

        FlywaySchemaMigration migration = new FlywaySchemaMigration(flyway, range);
        assertFalse(migration.isUpgradeable());
        assertFalse(migration.hasPendingMigrations());
        migration.migrate();

        assertFalse(flyway.migrated);
    }

    @Test
    void refusesMigrationWhenSchemaVersionIsBelowMinimumSupported() {
        FlywaySchemaRange range = new FlywaySchemaRange(2, 3);
        FakeFlyway flyway = new FakeFlyway(1, "1");

        FlywaySchemaMigration migration = new FlywaySchemaMigration(flyway, range);
        assertFalse(migration.isUpgradeable());
        assertFalse(migration.hasPendingMigrations());
        migration.migrate();

        assertFalse(flyway.migrated);
    }

    private static class FakeFlyway extends Flyway {

        private final MigrationInfoService migrationInfo;
        private boolean migrated;

        private FakeFlyway(int pendingCount, String currentVersion) {
            super(Flyway.configure());
            migrationInfo = new FakeMigrationInfoService(pendingCount, currentVersion);
        }

        @Override
        public MigrationInfoService info() {
            return migrationInfo;
        }

        @Override
        public MigrateResult migrate() {
            migrated = true;
            return null;
        }
    }

    private static class FakeMigrationInfoService implements MigrationInfoService {

        private final MigrationInfo[] pending;
        private final String currentVersion;

        private FakeMigrationInfoService(int pendingCount, String currentVersion) {
            this.pending = new MigrationInfo[pendingCount];
            this.currentVersion = currentVersion;
        }

        @Override
        public MigrationInfo[] pending() {
            return pending;
        }

        @Override
        public MigrationInfo[] all() {
            return new MigrationInfo[0];
        }

        @Override
        public MigrationInfo[] all(MigrationFilter filter) {
            return new MigrationInfo[0];
        }

        @Override
        public MigrationInfo current() {
            if (currentVersion == null) return null;
            return new FakeMigrationInfo(MigrationVersion.fromVersion(currentVersion));
        }

        @Override
        public MigrationInfo[] applied() {
            return new MigrationInfo[0];
        }

        @Override
        public InfoResult getInfoResult() {
            return null;
        }

        @Override
        public InfoResult getInfoResult(MigrationFilter filter) {
            return null;
        }
    }

    private static class FakeMigrationInfo implements MigrationInfo {

        private final MigrationVersion version;

        private FakeMigrationInfo(MigrationVersion version) {
            this.version = version;
        }

        @Override
        public org.flywaydb.core.extensibility.MigrationType getType() {
            return null;
        }

        @Override
        public String getPhysicalLocation() {
            return null;
        }

        @Override
        public int compareVersion(MigrationInfo other) {
            return 0;
        }

        @Override
        public Integer getChecksum() {
            return null;
        }

        @Override
        public MigrationVersion getVersion() {
            return version;
        }

        @Override
        public String getDescription() {
            return null;
        }

        @Override
        public String getScript() {
            return null;
        }

        @Override
        public org.flywaydb.core.api.MigrationState getState() {
            return null;
        }

        @Override
        public java.util.Date getInstalledOn() {
            return null;
        }

        @Override
        public String getInstalledBy() {
            return null;
        }

        @Override
        public Integer getInstalledRank() {
            return null;
        }

        @Override
        public Integer getExecutionTime() {
            return null;
        }

        @Override
        public int compareTo(MigrationInfo other) {
            return 0;
        }
    }
}
