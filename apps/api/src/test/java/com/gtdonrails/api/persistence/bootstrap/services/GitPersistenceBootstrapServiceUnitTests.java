package com.gtdonrails.api.persistence.bootstrap.services;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;

import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class GitPersistenceBootstrapServiceUnitTests {

    @TempDir
    Path tempDir;

    @Test
    void resolvesSimpleSqlitePath() {
        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(
            new PersistenceBootstrapProperties(),
            new GitCommandService()
        );

        Path resolvedPath = service.resolveSqlitePath("jdbc:sqlite:./gtd-persistence/db/gtd-on-rails.db");

        assertEquals(
            Path.of("./gtd-persistence/db/gtd-on-rails.db").toAbsolutePath().normalize(),
            resolvedPath);
    }

    @Test
    void resolvesFilePrefixedSqlitePathWithoutQueryString() {
        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(
            new PersistenceBootstrapProperties(),
            new GitCommandService()
        );

        Path resolvedPath = service.resolveSqlitePath("jdbc:sqlite:file:./gtd-persistence/db/gtd-on-rails.db?mode=rw");

        assertEquals(
            Path.of("./gtd-persistence/db/gtd-on-rails.db").toAbsolutePath().normalize(),
            resolvedPath);
    }

    @Test
    void rejectsNonSqliteJdbcUrls() {
        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(
            new PersistenceBootstrapProperties(),
            new GitCommandService()
        );

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> service.resolveSqlitePath("jdbc:postgresql://localhost/test"));

        assertEquals("Only jdbc:sqlite URLs are supported", exception.getMessage());
    }

    @Test
    void skipsBootstrapWhenDisabled() {
        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setEnabled(false);

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService());

        assertDoesNotThrow(() -> service.ensureDatabaseAvailable("jdbc:sqlite:./gtd-persistence/db/gtd-on-rails.db"));
    }

    @Test
    void requiresRepositoryUrlWhenBootstrapIsEnabledAndDatabaseIsMissing() {
        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setBranch("dev");
        Path cloneDirectory = tempDir.resolve("gtd-persistence");
        properties.setCloneDirectory(cloneDirectory.toString());

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService());

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service.ensureDatabaseAvailable("jdbc:sqlite:" + cloneDirectory.resolve("db/gtd-on-rails.db")));

        assertEquals("Missing gtd.persistence.bootstrap.repository-url", exception.getMessage());
    }
}
