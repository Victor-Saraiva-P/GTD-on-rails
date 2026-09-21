package com.gtdonrails.api.services;

import java.time.Duration;

import com.gtdonrails.api.maintenance.DatabaseSchemaCompatibilityInspector;
import com.gtdonrails.api.maintenance.SchemaCompatibilityStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseReadinessService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseReadinessService.class);

    // WHY: Readiness is checked frequently by the HTTP interceptor.
    // A short cache avoids repeated schema/identity queries on every request.
    static final long CACHE_TTL_NANOS = Duration.ofSeconds(5).toNanos();

    public static final String READINESS_QUERY =
        "select environment from database_identity where id = 1";

    private final JdbcTemplate jdbcTemplate;
    private final DatabaseSchemaCompatibilityInspector compatibilityInspector;
    private final String environment;

    // WHY volatile: interceptor reads from request threads; readinessState() writes from poller thread.
    private volatile DatabaseReadinessState cachedState;
    private volatile long cacheDeadlineNanos;

    public DatabaseReadinessService(
        JdbcTemplate jdbcTemplate,
        DatabaseSchemaCompatibilityInspector compatibilityInspector,
        @Value("${gtd.database.environment}") String environment
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.compatibilityInspector = compatibilityInspector;
        this.environment = environment;
    }

    /** Reports whether the configured local SQLite database can safely serve the application.
     * Returns cached result when available to avoid per-request database queries.
     *
     * <p>Example: {@code readinessService.isReady()}.</p>
     */
    public boolean isReady() {
        if (cachedState != null && cacheDeadlineNanos - System.nanoTime() > 0) {
            return cachedState == DatabaseReadinessState.READY;
        }
        return readinessState() == DatabaseReadinessState.READY;
    }

    /**
     * Performs a fresh readiness check against SQLite and updates the cache.
     *
     * <p>Example: {@code readinessService.readinessState()}.</p>
     */
    public DatabaseReadinessState readinessState() {
        SchemaCompatibilityStatus status = compatibilityInspector.inspectCompatibility();
        if (status == SchemaCompatibilityStatus.UPDATE_REQUIRED) return cacheAndReturn(DatabaseReadinessState.UPDATE_REQUIRED);
        if (status != SchemaCompatibilityStatus.COMPATIBLE) return cacheAndReturn(DatabaseReadinessState.UNAVAILABLE);
        return cacheAndReturn(queryDatabaseReadiness());
    }

    private DatabaseReadinessState cacheAndReturn(DatabaseReadinessState state) {
        cachedState = state;
        cacheDeadlineNanos = System.nanoTime() + CACHE_TTL_NANOS;
        return state;
    }

    private DatabaseReadinessState queryDatabaseReadiness() {
        try {
            boolean ready = environment.equals(jdbcTemplate.queryForObject(READINESS_QUERY, String.class));
            return ready ? DatabaseReadinessState.READY : DatabaseReadinessState.UNAVAILABLE;
        } catch (RuntimeException exception) {
            logger.atWarn()
                .addKeyValue("event", "database_readiness_query_failed")
                .setCause(exception)
                .log("Readiness query failed; reporting database as unavailable");
            return DatabaseReadinessState.UNAVAILABLE;
        }
    }

}
