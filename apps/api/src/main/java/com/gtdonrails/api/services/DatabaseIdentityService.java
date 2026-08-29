package com.gtdonrails.api.services;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseIdentityService {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseIdentityService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Refuses destructive work when the target database belongs to another environment.
     *
     * <p>Example: {@code databaseIdentityService.require("STAGING")}.</p>
     */
    public void require(String expectedIdentity) {
        String actualIdentity = readIdentity();
        if (expectedIdentity.equals(actualIdentity)) return;
        throw new IllegalStateException(
            "database identity value '%s' is invalid; expected %s".formatted(actualIdentity, expectedIdentity)
        );
    }

    private String readIdentity() {
        try {
            return jdbcTemplate.queryForObject(
                "select environment from database_identity where id = 1", String.class
            );
        } catch (RuntimeException exception) {
            throw new IllegalStateException(
                "database identity value 'unavailable' is invalid; expected STAGING", exception
            );
        }
    }
}
