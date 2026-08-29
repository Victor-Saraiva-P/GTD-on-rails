package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PostgresConnectionTests {

    @Test
    void ofNullableReturnsConnectionWhenParametersAreValid() {
        PostgresConnection connection = PostgresConnection.ofNullable(
            "jdbc:postgresql://localhost:5432/gtd_on_rails", "gtd", "secret"
        );

        assertNotNull(connection);
        assertEquals("localhost", connection.passfileEntry().split(":")[0]);
    }

    @Test
    void ofNullableReturnsNullWhenUrlIsInvalidOrNotPostgres() {
        assertNull(PostgresConnection.ofNullable("jdbc:sqlite:test.db", "gtd", "secret"));
        assertNull(PostgresConnection.ofNullable(null, "gtd", "secret"));
    }

    @Test
    void ofNullableReturnsNullWhenCredentialsAreBlankOrNull() {
        assertNull(PostgresConnection.ofNullable("jdbc:postgresql://localhost/db", "", "secret"));
        assertNull(PostgresConnection.ofNullable("jdbc:postgresql://localhost/db", "gtd", ""));
        assertNull(PostgresConnection.ofNullable("jdbc:postgresql://localhost/db", null, "secret"));
        assertNull(PostgresConnection.ofNullable("jdbc:postgresql://localhost/db", "gtd", null));
    }
}
