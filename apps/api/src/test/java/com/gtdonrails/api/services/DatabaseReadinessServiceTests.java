package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.gtdonrails.api.maintenance.DatabaseSchemaCompatibilityInspector;
import com.gtdonrails.api.maintenance.SchemaCompatibilityStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class DatabaseReadinessServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private DatabaseSchemaCompatibilityInspector compatibilityInspector;

    @Test
    void reportsReadyOnlyWhenPostgresqlMatchesTheRuntimeEnvironmentAndCompletedCutover() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.COMPATIBLE);
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenReturn("PRODUCTION|READY");

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertTrue(service.isReady());
        assertEquals(DatabaseReadinessState.READY, service.readinessState());
    }

    @Test
    void reportsUpdateRequiredWhenSchemaVersionIsNewerThanSupported() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.UPDATE_REQUIRED);

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertFalse(service.isReady());
        assertEquals(DatabaseReadinessState.UPDATE_REQUIRED, service.readinessState());
    }

    @Test
    void reportsUnavailableWhenSchemaHasPendingMigrations() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.UPGRADEABLE);

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertFalse(service.isReady());
        assertEquals(DatabaseReadinessState.UNAVAILABLE, service.readinessState());
    }

    @Test
    void reportsUnavailableWhenSchemaIsUnsupported() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.UNSUPPORTED);

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertFalse(service.isReady());
        assertEquals(DatabaseReadinessState.UNAVAILABLE, service.readinessState());
    }

    @Test
    void reportsUnavailableWhenPostgresqlCannotBeReached() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.COMPATIBLE);
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenThrow(new IllegalStateException("connection unavailable"));

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertFalse(service.isReady());
        assertEquals(DatabaseReadinessState.UNAVAILABLE, service.readinessState());
    }

    @Test
    void reportsUnavailableWhenTheCutoverIsNotReady() {
        when(compatibilityInspector.inspectCompatibility()).thenReturn(SchemaCompatibilityStatus.COMPATIBLE);
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenReturn("PRODUCTION|IMPORTING");

        DatabaseReadinessService service = new DatabaseReadinessService(
            jdbcTemplate, compatibilityInspector, "PRODUCTION");

        assertFalse(service.isReady());
        assertEquals(DatabaseReadinessState.UNAVAILABLE, service.readinessState());
    }
}
