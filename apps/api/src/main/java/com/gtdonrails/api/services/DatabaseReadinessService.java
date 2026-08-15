package com.gtdonrails.api.services;

import com.gtdonrails.api.maintenance.DatabaseSchemaCompatibilityInspector;
import com.gtdonrails.api.maintenance.SchemaCompatibilityStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseReadinessService {

    public static final String READINESS_QUERY =
        "select d.environment || '|' || c.state from gtd.database_identity d join gtd.database_cutover c on c.id = true where d.id = true";

    private final JdbcTemplate jdbcTemplate;
    private final DatabaseSchemaCompatibilityInspector compatibilityInspector;
    private final String environment;

    public DatabaseReadinessService(
        JdbcTemplate jdbcTemplate,
        DatabaseSchemaCompatibilityInspector compatibilityInspector,
        @Value("${gtd.database.environment}") String environment
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.compatibilityInspector = compatibilityInspector;
        this.environment = environment;
    }

    /** Reports whether the configured PostgreSQL database can safely serve the application.
     *
     * <p>Example: {@code readinessService.isReady()}.</p>
     */
    public boolean isReady() {
        return readinessState() == DatabaseReadinessState.READY;
    }

    /**
     * Inspects schema compatibility and PostgreSQL availability to determine readiness state.
     *
     * <p>Example: {@code readinessService.readinessState()}.</p>
     */
    public DatabaseReadinessState readinessState() {
        SchemaCompatibilityStatus status = compatibilityInspector.inspectCompatibility();
        if (status == SchemaCompatibilityStatus.UPDATE_REQUIRED) return DatabaseReadinessState.UPDATE_REQUIRED;
        if (status != SchemaCompatibilityStatus.COMPATIBLE) return DatabaseReadinessState.UNAVAILABLE;
        return queryDatabaseReadiness();
    }

    private DatabaseReadinessState queryDatabaseReadiness() {
        try {
            boolean ready = expectedReadiness().equals(jdbcTemplate.queryForObject(READINESS_QUERY, String.class));
            return ready ? DatabaseReadinessState.READY : DatabaseReadinessState.UNAVAILABLE;
        } catch (RuntimeException exception) {
            return DatabaseReadinessState.UNAVAILABLE;
        }
    }

    private String expectedReadiness() {
        return environment + "|READY";
    }
}
