package com.gtdonrails.api.config;

import javax.sql.DataSource;

import com.gtdonrails.api.persistence.bootstrap.GitPersistenceBootstrapService;
import com.gtdonrails.api.persistence.bootstrap.PersistenceBootstrapProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.sqlite.SQLiteDataSource;

@Configuration
@EnableConfigurationProperties(PersistenceBootstrapProperties.class)
public class SqliteDataSourceConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    DataSource dataSource(Environment environment, GitPersistenceBootstrapService bootstrapService) {
        String jdbcUrl = environment.getRequiredProperty("spring.datasource.url");
        bootstrapService.ensureDatabaseAvailable(jdbcUrl);

        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl(jdbcUrl);
        return dataSource;
    }
}
