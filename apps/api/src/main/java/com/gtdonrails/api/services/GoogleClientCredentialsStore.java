package com.gtdonrails.api.services;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.Properties;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.persistence.converters.CryptoConverter;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GoogleClientCredentialsStore {

    private static final String CLIENT_ID_KEY = "gtd.google.client-id";
    private static final String CLIENT_SECRET_KEY = "gtd.google.client-secret";
    private static final String TOKEN_ENCRYPTION_KEY = "gtd.google.token-encryption-key";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GoogleProperties googleProperties;
    private final PersistenceBootstrapProperties bootstrapProperties;

    public GoogleClientCredentialsStore(
        GoogleProperties googleProperties,
        PersistenceBootstrapProperties bootstrapProperties
    ) {
        this.googleProperties = googleProperties;
        this.bootstrapProperties = bootstrapProperties;
    }

    /**
     * Loads persisted Google OAuth client credentials into runtime properties.
     *
     * <p>Example: {@code credentialsStore.loadConfiguredCredentials()}.</p>
     */
    public boolean loadConfiguredCredentials() {
        if (propertiesConfigured()) return true;
        Optional<GoogleClientCredentials> credentials = readCredentials();
        credentials.ifPresent(this::applyCredentials);
        return credentials.isPresent();
    }

    /**
     * Persists Google OAuth client credentials and applies them to the current process.
     *
     * <p>Example: {@code credentialsStore.save("client-id", "client-secret")}.</p>
     */
    public void save(String clientId, String clientSecret) {
        String tokenEncryptionKey = existingTokenEncryptionKey().orElseGet(this::generateTokenEncryptionKey);
        GoogleClientCredentials credentials = new GoogleClientCredentials(
            clientId.trim(),
            clientSecret.trim(),
            tokenEncryptionKey);
        writeCredentials(credentials);
        applyCredentials(credentials);
    }

    /**
     * Captures current Google Integration Configuration file contents for rollback.
     *
     * <p>Example: {@code GoogleConfigurationSnapshot snapshot = store.snapshot()}.</p>
     */
    public GoogleConfigurationSnapshot snapshot() {
        Path path = credentialsPath();
        try {
            return new GoogleConfigurationSnapshot(Files.exists(path), readFileIfExists(path));
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Google credentials path value '" + path + "' is invalid; expected readable properties file",
                exception);
        }
    }

    /**
     * Restores a previously captured Google Integration Configuration file snapshot.
     *
     * <p>Example: {@code store.restore(snapshot)}.</p>
     */
    public void restore(GoogleConfigurationSnapshot snapshot) {
        Path path = credentialsPath();
        try {
            restoreSnapshotFile(path, snapshot);
            restoreRuntimeConfiguration(snapshot);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Google credentials path value '" + path + "' is invalid; expected restorable properties file",
                exception);
        }
    }

    /**
     * Returns the current Google Integration Configuration health.
     *
     * <p>Example: {@code credentialsStore.configurationHealth().status()}.</p>
     */
    public GoogleIntegrationConfigurationHealth configurationHealth() {
        Optional<GoogleClientCredentials> credentials = readCredentials();
        if (credentials.isEmpty() && !propertiesConfigured()) return missingHealth();

        Optional<String> tokenEncryptionKey = existingTokenEncryptionKey();
        if (tokenEncryptionKey.isEmpty()) return missingHealth();
        if (!tokenEncryptionKeyValid(tokenEncryptionKey.get())) return invalidKeyHealth();
        return readyHealth();
    }

    /**
     * Repairs legacy Google Integration Configuration by adding a missing Token Encryption Key.
     *
     * <p>Example: {@code credentialsStore.repairMissingTokenEncryptionKey()}.</p>
     */
    public boolean repairMissingTokenEncryptionKey() {
        Optional<GoogleClientCredentials> credentials = readCredentials();
        if (credentials.isEmpty() || StringUtils.hasText(credentials.get().tokenEncryptionKey())) return false;

        GoogleClientCredentials repaired = repairedCredentials(
            credentials.get().clientId(),
            credentials.get().clientSecret());
        writeCredentials(repaired);
        applyCredentials(repaired);
        return true;
    }

    private boolean propertiesConfigured() {
        return StringUtils.hasText(googleProperties.getClientId())
            && StringUtils.hasText(googleProperties.getClientSecret());
    }

    private GoogleIntegrationConfigurationHealth missingHealth() {
        return new GoogleIntegrationConfigurationHealth(
            GoogleIntegrationConfigurationStatus.MISSING,
            "Google Integration Configuration is missing client credentials.");
    }

    private GoogleIntegrationConfigurationHealth invalidKeyHealth() {
        return new GoogleIntegrationConfigurationHealth(
            GoogleIntegrationConfigurationStatus.INVALID,
            "Google Integration Configuration has an invalid Token Encryption Key.");
    }

    private GoogleIntegrationConfigurationHealth readyHealth() {
        return new GoogleIntegrationConfigurationHealth(
            GoogleIntegrationConfigurationStatus.READY,
            "Google Integration Configuration is ready.");
    }

    private Optional<GoogleClientCredentials> readCredentials() {
        Path path = credentialsPath();
        if (!Files.exists(path)) return Optional.empty();

        try (Reader reader = Files.newBufferedReader(path)) {
            Properties properties = new Properties();
            properties.load(reader);
            return credentialsFrom(properties);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Google credentials path value '" + path + "' is invalid; expected readable properties file",
                exception);
        }
    }

    private Optional<GoogleClientCredentials> credentialsFrom(Properties properties) {
        String clientId = properties.getProperty(CLIENT_ID_KEY);
        String clientSecret = properties.getProperty(CLIENT_SECRET_KEY);
        String tokenEncryptionKey = properties.getProperty(TOKEN_ENCRYPTION_KEY);
        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) return Optional.empty();
        return Optional.of(new GoogleClientCredentials(clientId, clientSecret, tokenEncryptionKey));
    }

    private GoogleClientCredentials repairedCredentials(String clientId, String clientSecret) {
        return new GoogleClientCredentials(clientId, clientSecret, generateTokenEncryptionKey());
    }

    private void writeCredentials(GoogleClientCredentials credentials) {
        Path path = credentialsPath();
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(
                path,
                contentFrom(credentials),
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Google credentials path value '" + path + "' is invalid; expected writable properties file",
                exception);
        }
    }

    private String contentFrom(GoogleClientCredentials credentials) {
        return CLIENT_ID_KEY + "=" + credentials.clientId() + "\n"
            + CLIENT_SECRET_KEY + "=" + credentials.clientSecret() + "\n"
            + TOKEN_ENCRYPTION_KEY + "=" + credentials.tokenEncryptionKey() + "\n";
    }

    private void applyCredentials(GoogleClientCredentials credentials) {
        googleProperties.setClientId(credentials.clientId());
        googleProperties.setClientSecret(credentials.clientSecret());
        googleProperties.setTokenEncryptionKey(credentials.tokenEncryptionKey());
        CryptoConverter.applyTokenEncryptionKey(credentials.tokenEncryptionKey());
    }

    private void clearCredentials() {
        googleProperties.setClientId(null);
        googleProperties.setClientSecret(null);
        googleProperties.setTokenEncryptionKey(null);
        CryptoConverter.applyTokenEncryptionKey(null);
    }

    private Optional<String> existingTokenEncryptionKey() {
        if (StringUtils.hasText(googleProperties.getTokenEncryptionKey())) {
            return Optional.of(googleProperties.getTokenEncryptionKey());
        }

        return readCredentials().map(GoogleClientCredentials::tokenEncryptionKey);
    }

    private String generateTokenEncryptionKey() {
        byte[] key = new byte[32];
        RANDOM.nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    private boolean tokenEncryptionKeyValid(String value) {
        try {
            return Base64.getDecoder().decode(value).length == 32;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private Path credentialsPath() {
        return Path.of(bootstrapProperties.getCloneDirectory(), "config", "google.properties");
    }

    private String readFileIfExists(Path path) throws IOException {
        if (!Files.exists(path)) return "";
        return Files.readString(path);
    }

    private void restoreSnapshotFile(Path path, GoogleConfigurationSnapshot snapshot) throws IOException {
        if (!snapshot.existed()) {
            Files.deleteIfExists(path);
            return;
        }

        Files.createDirectories(path.getParent());
        Files.writeString(path, snapshot.contents(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    private void restoreRuntimeConfiguration(GoogleConfigurationSnapshot snapshot) {
        if (!snapshot.existed()) {
            clearCredentials();
            return;
        }

        readCredentials().ifPresentOrElse(this::applyCredentials, this::clearCredentials);
    }

    private record GoogleClientCredentials(String clientId, String clientSecret, String tokenEncryptionKey) {
    }

    public record GoogleConfigurationSnapshot(boolean existed, String contents) {
    }
}
