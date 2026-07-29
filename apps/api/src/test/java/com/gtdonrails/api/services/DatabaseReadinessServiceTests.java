package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class DatabaseReadinessServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void reportsReadyOnlyWhenPostgresqlMatchesTheRuntimeEnvironmentAndCompletedCutover() {
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenReturn("PRODUCTION|READY");

        DatabaseReadinessService service = new DatabaseReadinessService(jdbcTemplate, "PRODUCTION");

        assertTrue(service.isReady());
    }

    @Test
    void reportsUnavailableWhenPostgresqlCannotBeReached() {
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenThrow(new IllegalStateException("connection unavailable"));

        DatabaseReadinessService service = new DatabaseReadinessService(jdbcTemplate, "PRODUCTION");

        assertFalse(service.isReady());
    }

    @Test
    void reportsUnavailableWhenTheCutoverIsNotReady() {
        when(jdbcTemplate.queryForObject(DatabaseReadinessService.READINESS_QUERY, String.class))
            .thenReturn("PRODUCTION|IMPORTING");

        DatabaseReadinessService service = new DatabaseReadinessService(jdbcTemplate, "PRODUCTION");

        assertFalse(service.isReady());
    }
}
