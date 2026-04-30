package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class SqliteJdbcUrlResolverTests {

    private final SqliteJdbcUrlResolver resolver = new SqliteJdbcUrlResolver();

    @Test
    void resolvesSimpleSqlitePath() {
        Path resolvedPath = resolver.resolve("jdbc:sqlite:./gtd-persistence/db/gtd-on-rails.db");

        assertEquals(
            Path.of("./gtd-persistence/db/gtd-on-rails.db").toAbsolutePath().normalize(),
            resolvedPath);
    }

    @Test
    void resolvesFilePrefixedSqlitePathWithoutQueryString() {
        Path resolvedPath = resolver.resolve("jdbc:sqlite:file:./gtd-persistence/db/gtd-on-rails.db?mode=rw");

        assertEquals(
            Path.of("./gtd-persistence/db/gtd-on-rails.db").toAbsolutePath().normalize(),
            resolvedPath);
    }

    @Test
    void rejectsNonSqliteJdbcUrls() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> resolver.resolve("jdbc:postgresql://localhost/test"));

        assertEquals("JDBC URL value 'jdbc:postgresql://localhost/test' is invalid; expected jdbc:sqlite:<path>", exception.getMessage());
    }
}
