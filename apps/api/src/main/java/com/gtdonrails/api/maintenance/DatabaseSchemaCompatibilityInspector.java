package com.gtdonrails.api.maintenance;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class DatabaseSchemaCompatibilityInspector {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseSchemaCompatibilityInspector.class);

    public static final String LATEST_SCHEMA_VERSION_QUERY =
        "select version from gtd.flyway_schema_history where success = true order by installed_rank desc limit 1";

    private final JdbcTemplate jdbcTemplate;
    private final FlywaySchemaRange supportedSchemaRange;

    public DatabaseSchemaCompatibilityInspector(
        JdbcTemplate jdbcTemplate,
        FlywaySchemaRange supportedSchemaRange
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.supportedSchemaRange = supportedSchemaRange;
    }

    /**
     * Evaluates current PostgreSQL schema history against this sidecar's supported range.
     *
     * <p>Example: {@code inspector.inspectCompatibility()}.</p>
     */
    public SchemaCompatibilityStatus inspectCompatibility() {
        try {
            return supportedSchemaRange.evaluate(currentDatabaseSchemaVersion());
        } catch (RuntimeException exception) {
            logger.atWarn()
                .addKeyValue("event", "schema_compatibility_check_failed")
                .setCause(exception)
                .log("Schema compatibility check failed; reporting as unsupported");
            return SchemaCompatibilityStatus.UNSUPPORTED;
        }
    }

    /**
     * Reads the latest successfully applied Flyway schema version from the database.
     *
     * <p>Example: {@code inspector.currentDatabaseSchemaVersion()}.</p>
     */
    public String currentDatabaseSchemaVersion() {
        try {
            return jdbcTemplate.queryForObject(LATEST_SCHEMA_VERSION_QUERY, String.class);
        } catch (EmptyResultDataAccessException | BadSqlGrammarException exception) {
            return null;
        }
    }

    public FlywaySchemaRange supportedSchemaRange() {
        return supportedSchemaRange;
    }
}
