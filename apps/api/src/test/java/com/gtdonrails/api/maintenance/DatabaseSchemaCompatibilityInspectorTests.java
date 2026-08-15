package com.gtdonrails.api.maintenance;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatabaseSchemaCompatibilityInspectorTests {

    @Test
    void reportsCompatibleWhenDatabaseSchemaMatchesMaxSupported() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenReturn("2");

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.COMPATIBLE);
        assertThat(inspector.currentDatabaseSchemaVersion()).isEqualTo("2");
    }

    @Test
    void reportsUpgradeableWhenDatabaseSchemaIsOlderThanMaxSupported() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenReturn("1");

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UPGRADEABLE);
    }

    @Test
    void reportsUpdateRequiredWhenDatabaseSchemaIsNewerThanMaxSupported() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenReturn("3");

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UPDATE_REQUIRED);
    }

    @Test
    void reportsUnsupportedWhenDatabaseSchemaIsOlderThanMinSupported() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenReturn("1");

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(2, 3)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UNSUPPORTED);
    }

    @Test
    void reportsUpgradeableWhenDatabaseSchemaHistoryIsEmpty() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenThrow(new EmptyResultDataAccessException(1));

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UPGRADEABLE);
        assertThat(inspector.currentDatabaseSchemaVersion()).isNull();
    }

    @Test
    void reportsUpgradeableWhenSchemaHistoryTableDoesNotExistYet() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenThrow(new BadSqlGrammarException("query", "select ...", new SQLException("relation does not exist")));

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UPGRADEABLE);
        assertThat(inspector.currentDatabaseSchemaVersion()).isNull();
    }

    @Test
    void reportsUnsupportedWhenDatabaseQueryFailsDueToConnectionException() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(DatabaseSchemaCompatibilityInspector.LATEST_SCHEMA_VERSION_QUERY, String.class))
            .thenThrow(new DataRetrievalFailureException("connection refused"));

        DatabaseSchemaCompatibilityInspector inspector = new DatabaseSchemaCompatibilityInspector(
            jdbcTemplate,
            new FlywaySchemaRange(1, 2)
        );

        assertThat(inspector.inspectCompatibility()).isEqualTo(SchemaCompatibilityStatus.UNSUPPORTED);
    }
}
