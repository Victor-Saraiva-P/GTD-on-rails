package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class DatabaseIdentityServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void rejectsAProductionDatabaseBeforeReset() {
        when(jdbcTemplate.queryForObject(
            "select environment from gtd.database_identity where id = true", String.class
        )).thenReturn("PRODUCTION");

        DatabaseIdentityService service = new DatabaseIdentityService(jdbcTemplate);

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.require("STAGING"));
        org.junit.jupiter.api.Assertions.assertEquals(
            "database identity value 'PRODUCTION' is invalid; expected STAGING", error.getMessage()
        );
    }
}
