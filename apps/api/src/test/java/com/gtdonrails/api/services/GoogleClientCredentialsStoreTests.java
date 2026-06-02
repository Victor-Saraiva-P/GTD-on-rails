package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

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
        assertTrue(Files.readString(tempDir.resolve("config/google.properties")).contains(expectedCredentialsFile()));
    }

    @Test
    void saveGeneratesAndAppliesTokenEncryptionKey() throws Exception {
        store.save("new-client", "new-secret");

        String tokenEncryptionKey = googleProperties.getTokenEncryptionKey();
        assertNotNull(tokenEncryptionKey);
        assertEquals(32, Base64.getDecoder().decode(tokenEncryptionKey).length);
        assertTrue(Files.readString(tempDir.resolve("config/google.properties"))
            .contains("gtd.google.token-encryption-key=" + tokenEncryptionKey));
    }

    @Test
    void saveRejectsNullClientId() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> store.save(null, "new-secret"));

        assertEquals(
            "Google credential clientId value 'null' is invalid; expected non-empty, non-null string",
            exception.getMessage());
    }

    @Test
    void saveRejectsBlankClientSecret() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> store.save("new-client", " "));

        assertEquals(
            "Google credential clientSecret value ' ' is invalid; expected non-empty, non-null string",
            exception.getMessage());
    }

    @Test
    void configurationHealthIsInvalidWhenTokenEncryptionKeyIsMalformed() throws Exception {
        Files.createDirectories(tempDir.resolve("config"));
        Files.writeString(tempDir.resolve("config/google.properties"), """
            gtd.google.client-id=persisted-client
            gtd.google.client-secret=persisted-secret
            gtd.google.token-encryption-key=not-base64
            """);

        GoogleIntegrationConfigurationHealth health = store.configurationHealth();

        assertEquals(GoogleIntegrationConfigurationStatus.INVALID, health.status());
        assertTrue(health.message().contains("Token Encryption Key"));
    }

    @Test
    void repairMissingTokenEncryptionKeyWritesGeneratedKey() throws Exception {
        Files.createDirectories(tempDir.resolve("config"));
        Files.writeString(tempDir.resolve("config/google.properties"), expectedCredentialsFile());

        assertTrue(store.repairMissingTokenEncryptionKey());

        String tokenEncryptionKey = googleProperties.getTokenEncryptionKey();
        assertNotNull(tokenEncryptionKey);
        assertTrue(Files.readString(tempDir.resolve("config/google.properties"))
            .contains("gtd.google.token-encryption-key=" + tokenEncryptionKey));
    }

    private String expectedCredentialsFile() {
        return "gtd.google.client-id=new-client\n"
            + "gtd.google.client-secret=new-secret\n";
    }
}
