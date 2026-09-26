package com.gtdonrails.api.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Configures the primary SQLite DataSource and JdbcTemplate used by JPA, Hibernate, and Flyway.
 *
 * <p>The application has one runtime database: local SQLite. This explicit
 * configuration applies WAL, busy timeout, and single-writer pool settings.</p>
 *
 * <p>Example: {@code @Autowired JdbcTemplate jdbcTemplate} injects SQLite.</p>
 */
@Configuration
public class PrimaryDataSourceConfig {

    @Bean(name = "dataSource")
    @Primary
    public DataSource dataSource(
        @Value("${spring.datasource.url}") String url,
        @Value("${spring.datasource.driver-class-name:org.sqlite.JDBC}") String driverClass,
        @Value("${spring.datasource.hikari.maximum-pool-size:4}") int maxPoolSize,
        @Value("${spring.datasource.hikari.minimum-idle:1}") int minIdle
    ) {
        com.zaxxer.hikari.HikariConfig config = new com.zaxxer.hikari.HikariConfig();
        config.setDriverClassName(driverClass);
        config.setJdbcUrl(url);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setPoolName("HikariPool-Primary");
        config.setDataSourceProperties(sqliteProperties());
        return new com.zaxxer.hikari.HikariDataSource(config);
    }

    private java.util.Properties sqliteProperties() {
        org.sqlite.SQLiteConfig sqliteConfig = new org.sqlite.SQLiteConfig();
        sqliteConfig.setBusyTimeout(30000);
        sqliteConfig.setJournalMode(org.sqlite.SQLiteConfig.JournalMode.WAL);
        sqliteConfig.setSynchronous(org.sqlite.SQLiteConfig.SynchronousMode.NORMAL);
        sqliteConfig.setTransactionMode(org.sqlite.SQLiteConfig.TransactionMode.IMMEDIATE);
        return sqliteConfig.toProperties();
    }

    /** Provides the canonical JdbcTemplate backed by local SQLite. */
    @Bean
    @Primary
    public JdbcTemplate jdbcTemplate(@Qualifier("dataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean(name = "flyway")
    @Primary
    public org.flywaydb.core.Flyway flyway(
        @Qualifier("dataSource") DataSource dataSource,
        @Value("${spring.flyway.locations:classpath:db/sqlite-migration}") String locations,
        @Value("${spring.flyway.baseline-on-migrate:true}") boolean baselineOnMigrate,
        @Value("${spring.flyway.baseline-version:0}") String baselineVersion,
        @Value("${spring.flyway.placeholders.databaseIdentity:STAGING}") String databaseIdentity
    ) {
        org.flywaydb.core.Flyway flyway = org.flywaydb.core.Flyway.configure()
            .dataSource(dataSource)
            .locations(locations.split(","))
            .baselineOnMigrate(baselineOnMigrate)
            .baselineVersion(baselineVersion)
            .placeholders(java.util.Map.of("databaseIdentity", databaseIdentity))
            .load();
        flyway.migrate();
        sanitizeTimestamps(dataSource);
        return flyway;
    }

    private void sanitizeTimestamps(DataSource dataSource) {
        JdbcTemplate template = new JdbcTemplate(dataSource);
        java.util.List<String> tables = java.util.List.of(
            "items", "contexts", "projects", "next_actions", "calendars", "item_assets", "context_icon_assets"
        );
        for (String table : tables) {
            for (String col : java.util.List.of("created_at", "updated_at", "deleted_at")) {
                sanitizeColumn(template, table, col);
            }
        }
    }

    private void sanitizeColumn(JdbcTemplate template, String table, String col) {
        template.update(
            "UPDATE " + table + " SET " + col + " = substr(" + col + ", 1, 19) || '.000000' || substr(" + col + ", 20) "
            + "WHERE " + col + " LIKE '____-__-__ __:__:__+%' AND " + col + " NOT LIKE '%.%'"
        );
    }
}
