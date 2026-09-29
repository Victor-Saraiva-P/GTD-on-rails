package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class OrphanedNextActionContextMigrationTests {

    @Test
    void versionFiveRemovesContextLinksLeftByOrphanedNextActions() {
        DataSource dataSource = new PrimaryDataSourceConfig().dataSource("jdbc:sqlite::memory:", "org.sqlite.JDBC", 1, 1);
        try {
            migrate(dataSource, "4");
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("insert into contexts (id, name, created_at, updated_at) values ('ctx-1', 'Work', '2026-01-01', '2026-01-01')");
            jdbc.update("insert into next_action_contexts (next_action_id, context_id) values ('missing-action', 'ctx-1')");

            migrate(dataSource, "5");

            assertEquals(0, jdbc.queryForObject("select count(*) from next_action_contexts", Integer.class));
        } finally {
            close(dataSource);
        }
    }

    private void migrate(DataSource dataSource, String targetVersion) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/sqlite-migration")
            .baselineOnMigrate(true)
            .baselineVersion(MigrationVersion.fromVersion("0"))
            .placeholders(java.util.Map.of("databaseIdentity", "TEST"))
            .target(MigrationVersion.fromVersion(targetVersion))
            .load()
            .migrate();
    }

    private void close(DataSource dataSource) {
        if (dataSource instanceof AutoCloseable closeable) {
            try { closeable.close(); } catch (Exception ignored) { }
        }
    }
}
