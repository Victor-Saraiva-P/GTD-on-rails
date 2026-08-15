package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationFilter;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.output.InfoResult;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;

class FlywaySchemaMigrationTests {

    @Test
    void reportsWhetherFlywayHasPendingMigrations() {
        assertTrue(new FlywaySchemaMigration(new FakeFlyway(1)).hasPendingMigrations());
        assertFalse(new FlywaySchemaMigration(new FakeFlyway(0)).hasPendingMigrations());
    }

    @Test
    void delegatesMigrationToFlyway() {
        FakeFlyway flyway = new FakeFlyway(0);

        new FlywaySchemaMigration(flyway).migrate();

        assertTrue(flyway.migrated);
    }

    private static class FakeFlyway extends Flyway {

        private final MigrationInfoService migrationInfo;
        private boolean migrated;

        private FakeFlyway(int pendingCount) {
            super(Flyway.configure());
            migrationInfo = new FakeMigrationInfoService(pendingCount);
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

        private FakeMigrationInfoService(int pendingCount) {
            pending = new MigrationInfo[pendingCount];
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
            return null;
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
}
