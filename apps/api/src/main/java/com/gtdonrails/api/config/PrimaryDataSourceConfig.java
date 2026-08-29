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
 * <p>WHY: Spring Boot's DataSourceAutoConfiguration and JdbcTemplateAutoConfiguration
 * back off when secondary DataSource/JdbcTemplate beans (supabaseDataSource,
 * supabaseJdbcTemplate) are declared. Explicitly defining these primary beans
 * ensures JPA, Flyway, and all unqualified JdbcTemplate injections bind to
 * the local SQLite database.</p>
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
        @Value("${spring.datasource.hikari.maximum-pool-size:1}") int maxPoolSize,
        @Value("${spring.datasource.hikari.minimum-idle:1}") int minIdle
    ) {
        org.sqlite.SQLiteConfig sqliteConfig = new org.sqlite.SQLiteConfig();
        sqliteConfig.setBusyTimeout(30000);
        sqliteConfig.setJournalMode(org.sqlite.SQLiteConfig.JournalMode.WAL);
        sqliteConfig.setSynchronous(org.sqlite.SQLiteConfig.SynchronousMode.NORMAL);

        com.zaxxer.hikari.HikariConfig config = new com.zaxxer.hikari.HikariConfig();
        config.setDriverClassName(driverClass);
        config.setJdbcUrl(url);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setPoolName("HikariPool-Primary");
        config.setDataSourceProperties(sqliteConfig.toProperties());
        return new com.zaxxer.hikari.HikariDataSource(config);
    }

    /** WHY: JdbcTemplateAutoConfiguration backs off when supabaseJdbcTemplate exists.
     * Without this bean, unqualified JdbcTemplate injection resolves to supabaseJdbcTemplate
     * (PostgreSQL), breaking DatabaseReadinessService and schema compatibility checks. */
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
        return flyway;
    }
}
