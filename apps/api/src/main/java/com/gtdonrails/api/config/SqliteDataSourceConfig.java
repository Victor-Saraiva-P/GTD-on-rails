package com.gtdonrails.api.config;

import java.nio.file.Files;
import java.nio.file.Path;

import javax.sql.DataSource;

import com.gtdonrails.api.persistence.bootstrap.services.SqliteJdbcUrlResolver;
import com.gtdonrails.api.services.DataSyncService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.sqlite.SQLiteDataSource;

@Configuration
@EnableConfigurationProperties({AssetsProperties.class, DataSyncProperties.class})
public class SqliteDataSourceConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    DataSource dataSource(
        Environment environment,
        DataSyncService dataSyncService,
        DatabaseInitializationState databaseInitializationState,
        SqliteJdbcUrlResolver sqliteJdbcUrlResolver
    ) throws Exception {
        String jdbcUrl = environment.getRequiredProperty("spring.datasource.url");
        dataSyncService.syncOnStartup();
        createDatabaseWhenMissing(sqliteJdbcUrlResolver.resolve(jdbcUrl), databaseInitializationState);

        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl(jdbcUrl);
        return dataSource;
    }

    private void createDatabaseWhenMissing(Path databasePath, DatabaseInitializationState databaseInitializationState) throws Exception {
        if (Files.exists(databasePath)) return;

        Files.createDirectories(databasePath.getParent());
        Files.createFile(databasePath);
        databaseInitializationState.markCreatedEmptyDatabase();
    }
}
