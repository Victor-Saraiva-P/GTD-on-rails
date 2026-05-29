package com.gtdonrails.api.services;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Optional;
import java.util.Properties;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.persistence.bootstrap.properties.PersistenceBootstrapProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GoogleClientCredentialsStore {

    private static final String CLIENT_ID_KEY = "gtd.google.client-id";
    private static final String CLIENT_SECRET_KEY = "gtd.google.client-secret";

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
        GoogleClientCredentials credentials = new GoogleClientCredentials(clientId.trim(), clientSecret.trim());
        writeCredentials(credentials);
        applyCredentials(credentials);
    }

    private boolean propertiesConfigured() {
        return StringUtils.hasText(googleProperties.getClientId())
            && StringUtils.hasText(googleProperties.getClientSecret());
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
        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) return Optional.empty();
        return Optional.of(new GoogleClientCredentials(clientId, clientSecret));
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
            + CLIENT_SECRET_KEY + "=" + credentials.clientSecret() + "\n";
    }

    private void applyCredentials(GoogleClientCredentials credentials) {
        googleProperties.setClientId(credentials.clientId());
        googleProperties.setClientSecret(credentials.clientSecret());
    }

    private Path credentialsPath() {
        return Path.of(bootstrapProperties.getCloneDirectory(), "config", "google.properties");
    }

    private record GoogleClientCredentials(String clientId, String clientSecret) {
    }
}
