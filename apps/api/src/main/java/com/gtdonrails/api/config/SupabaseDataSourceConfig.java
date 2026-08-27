package com.gtdonrails.api.config;

import javax.sql.DataSource;

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
        return DataSourceBuilder.create()
            .driverClassName("org.postgresql.Driver")
            .url(url)
            .username(username)
            .password(password)
            .build();
    }

    @Bean("supabaseJdbcTemplate")
    public JdbcTemplate supabaseJdbcTemplate(DataSource supabaseDataSource) {
        return new JdbcTemplate(supabaseDataSource);
    }
}
