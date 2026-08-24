package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import org.junit.jupiter.api.Test;

class DatabaseRuntimeConfigurationTests {

    @Test
    void usesPostgresqlAsTheDefaultRuntimeDatabase() throws IOException {
        Properties properties = load("application.properties");

        assertEquals("org.postgresql.Driver", properties.getProperty("spring.datasource.driver-class-name"));
        assertEquals("org.hibernate.dialect.PostgreSQLDialect", properties.getProperty("spring.jpa.database-platform"));
        assertEquals("classpath:db/postgresql-migration", properties.getProperty("spring.flyway.locations"));
        assertFalse(properties.values().stream().map(Object::toString).anyMatch(value -> value.contains("jdbc:sqlite")));
    }

    @Test
    void declaresSupportedFlywaySchemaRange() throws IOException {
        Properties properties = load("application.properties");

        assertEquals("${GTD_SCHEMA_MIN_SUPPORTED_VERSION:1}", properties.getProperty("gtd.schema.min-supported-version"));
        assertEquals("${GTD_SCHEMA_MAX_SUPPORTED_VERSION:3}", properties.getProperty("gtd.schema.max-supported-version"));
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
