package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;
import javax.sql.DataSource;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;

class DatabaseRuntimeConfigurationTests {

    @Test
    void usesSqliteAsTheDefaultRuntimeDatabase() throws IOException {
        Properties properties = load("application.properties");

        assertEquals("org.sqlite.JDBC", properties.getProperty("spring.datasource.driver-class-name"));
        assertEquals("org.hibernate.community.dialect.SQLiteDialect", properties.getProperty("spring.jpa.database-platform"));
        assertEquals("classpath:db/sqlite-migration", properties.getProperty("spring.flyway.locations"));
        assertEquals("4", properties.getProperty("spring.datasource.hikari.maximum-pool-size"));
        assertEquals("false", properties.getProperty("spring.jpa.open-in-view"));
    }

    @Test
    void declaresSupportedFlywaySchemaRange() throws IOException {
        Properties properties = load("application.properties");

        assertEquals("${GTD_SCHEMA_MIN_SUPPORTED_VERSION:1}", properties.getProperty("gtd.schema.min-supported-version"));
        assertEquals("${GTD_SCHEMA_MAX_SUPPORTED_VERSION:3}", properties.getProperty("gtd.schema.max-supported-version"));
    }

    @Test
    void configuresSqliteWithImmediateTransactionMode() {
        PrimaryDataSourceConfig config = new PrimaryDataSourceConfig();
        DataSource dataSource = config.dataSource("jdbc:sqlite::memory:", "org.sqlite.JDBC", 1, 1);
        try {
            assertTrue(dataSource instanceof HikariDataSource);
            HikariDataSource hikari = (HikariDataSource) dataSource;
            assertEquals("IMMEDIATE", hikari.getDataSourceProperties().getProperty("transaction_mode"));
        } finally {
            if (dataSource instanceof AutoCloseable closeable) {
                try { closeable.close(); } catch (Exception ignored) {}
            }
        }
    }

    private Properties load(String resourceName) throws IOException {
        try (InputStream resource = getClass().getClassLoader().getResourceAsStream(resourceName)) {
            if (resource == null) throw new IOException("configuration resource value '" + resourceName + "' is invalid; expected classpath resource");
            Properties properties = new Properties();
            properties.load(resource);
            return properties;
        }
    }
}
