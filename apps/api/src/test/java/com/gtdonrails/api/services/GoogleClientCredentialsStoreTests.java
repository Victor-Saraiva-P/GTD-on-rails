package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@Tag("unit")
class GoogleClientCredentialsStoreTests {

    @TempDir
    private Path tempDir;

    private GoogleProperties googleProperties;
    private GoogleClientCredentialsStore store;

    @BeforeEach
    void setUp() {
        googleProperties = new GoogleProperties();
        PersistenceBootstrapProperties bootstrapProperties = new PersistenceBootstrapProperties();
        bootstrapProperties.setCloneDirectory(tempDir.toString());
        store = new GoogleClientCredentialsStore(googleProperties, bootstrapProperties);
    }

    @Test
    void loadConfiguredCredentialsAppliesPersistedProperties() throws Exception {
        Files.createDirectories(tempDir.resolve("config"));
        Files.writeString(tempDir.resolve("config/google.properties"), """
            gtd.google.client-id=persisted-client
            gtd.google.client-secret=persisted-secret
            """);

        assertTrue(store.loadConfiguredCredentials());
        assertEquals("persisted-client", googleProperties.getClientId());
        assertEquals("persisted-secret", googleProperties.getClientSecret());
    }

    @Test
    void saveWritesCredentialsAndAppliesCurrentProcessProperties() throws Exception {
        store.save(" new-client ", " new-secret ");

        assertEquals("new-client", googleProperties.getClientId());
        assertEquals("new-secret", googleProperties.getClientSecret());
        assertEquals(expectedCredentialsFile(), Files.readString(tempDir.resolve("config/google.properties")));
    }

    private String expectedCredentialsFile() {
        return "gtd.google.client-id=new-client\n"
            + "gtd.google.client-secret=new-secret\n";
    }
}
