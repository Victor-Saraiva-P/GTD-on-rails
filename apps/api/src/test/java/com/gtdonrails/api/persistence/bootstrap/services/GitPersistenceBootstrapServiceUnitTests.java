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
    void skipsBootstrapWhenDisabled() {
        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setEnabled(false);

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService(), new SqliteJdbcUrlResolver());

        assertDoesNotThrow(() -> service.ensureDatabaseAvailable("jdbc:sqlite:./gtd-persistence/db/gtd-on-rails.db"));
    }

    @Test
    void requiresRepositoryUrlWhenBootstrapIsEnabledAndDatabaseIsMissing() {
        PersistenceBootstrapProperties properties = new PersistenceBootstrapProperties();
        properties.setBranch("dev");
        Path cloneDirectory = tempDir.resolve("gtd-persistence");
        properties.setCloneDirectory(cloneDirectory.toString());

        GitPersistenceBootstrapService service = new GitPersistenceBootstrapService(properties, new GitCommandService(), new SqliteJdbcUrlResolver());

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service.ensureDatabaseAvailable("jdbc:sqlite:" + cloneDirectory.resolve("db/gtd-on-rails.db")));

        assertEquals("Missing gtd.persistence.bootstrap.repository-url", exception.getMessage());
    }
}
