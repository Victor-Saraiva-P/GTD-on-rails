package com.gtdonrails.api.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Configures a secondary JDBC connection to the remote Supabase PostgreSQL database
 * used exclusively by the outbox sync worker.
 *
 * <p>WHY: The primary DataSource points to local SQLite for fast reads/writes.
 * This secondary connection is only used by SupabasePushSyncService to push
 * outbox events, keeping the sync path independent of the primary data path.</p>
 *
 * <p>Example: enabled when {@code gtd.sync.database.enabled=true}.</p>
 */
@Configuration
@ConditionalOnProperty(name = "gtd.sync.database.enabled", havingValue = "true")
public class SupabaseDataSourceConfig {

    @Bean("supabaseDataSource")
    public DataSource supabaseDataSource(
        @Value("${gtd.sync.database.supabase.url}") String url,
        @Value("${gtd.sync.database.supabase.username}") String username,
        @Value("${gtd.sync.database.supabase.password}") String password
    ) {
        String effectiveUrl = url.contains("stringType=") ? url : (url.contains("?") ? url + "&stringType=unspecified" : url + "?stringType=unspecified");
        com.zaxxer.hikari.HikariConfig config = new com.zaxxer.hikari.HikariConfig();
        config.setDriverClassName("org.postgresql.Driver");
        config.setJdbcUrl(effectiveUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(2);
        config.setMinimumIdle(1);
        config.setPoolName("HikariPool-Supabase");
        config.setMaxLifetime(60000);
        config.setIdleTimeout(30000);
        return new com.zaxxer.hikari.HikariDataSource(config);
    }

    @Bean("supabaseFlyway")
    public org.flywaydb.core.Flyway supabaseFlyway(
        @Qualifier("supabaseDataSource") DataSource supabaseDataSource,
        @Value("${spring.flyway.placeholders.databaseIdentity:STAGING}") String databaseIdentity
    ) {
        org.flywaydb.core.Flyway flyway = org.flywaydb.core.Flyway.configure()
            .dataSource(supabaseDataSource)
            .schemas("gtd")
            .defaultSchema("gtd")
            .locations("classpath:db/postgresql-migration")
            .baselineOnMigrate(true)
            .baselineVersion("0")
            .placeholders(java.util.Map.of("databaseIdentity", databaseIdentity))
            .load();
        flyway.migrate();
        return flyway;
    }

    @Bean("supabaseJdbcTemplate")
    @org.springframework.context.annotation.DependsOn("supabaseFlyway")
    public JdbcTemplate supabaseJdbcTemplate(
        @Qualifier("supabaseDataSource") DataSource supabaseDataSource
    ) {
        return new JdbcTemplate(supabaseDataSource);
    }
}
