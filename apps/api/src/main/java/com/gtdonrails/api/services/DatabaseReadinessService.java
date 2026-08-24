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

    // WHY: Querying readiness on every HTTP request is fragile over Supavisor pooled connections.
    // A short cache prevents stale-connection exceptions from cascading into 503 flicker loops.
    static final long CACHE_TTL_NANOS = Duration.ofSeconds(5).toNanos();

    public static final String READINESS_QUERY =
        "select d.environment || '|' || c.state from gtd.database_identity d join gtd.database_cutover c on c.id = true where d.id = true";

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

    /** Reports whether the configured PostgreSQL database can safely serve the application.
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
     * Performs a fresh readiness check against PostgreSQL and updates the cache.
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
            boolean ready = expectedReadiness().equals(jdbcTemplate.queryForObject(READINESS_QUERY, String.class));
            return ready ? DatabaseReadinessState.READY : DatabaseReadinessState.UNAVAILABLE;
        } catch (RuntimeException exception) {
            logger.atWarn()
                .addKeyValue("event", "database_readiness_query_failed")
                .setCause(exception)
                .log("Readiness query failed; reporting database as unavailable");
            return DatabaseReadinessState.UNAVAILABLE;
        }
    }

    private String expectedReadiness() {
        return environment + "|READY";
    }
}
