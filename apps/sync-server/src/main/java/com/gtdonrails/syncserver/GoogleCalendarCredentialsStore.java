package com.gtdonrails.syncserver;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class GoogleCalendarCredentialsStore {

    private static final String CLIENT_ID = "clientId";
    private static final String CLIENT_SECRET = "clientSecret";
    private static final String ACCESS_TOKEN = "accessToken";
    private static final String REFRESH_TOKEN = "refreshToken";
    private static final String TOKEN_TYPE = "tokenType";
    private static final String SCOPE = "scope";
    private static final String EXPIRES_AT = "expiresAt";
    private static final String OAUTH_STATE = "oauthState";
    private static final String OAUTH_STATE_CREATED_AT = "oauthStateCreatedAt";

    private final Path path;

    @Autowired
    public GoogleCalendarCredentialsStore(
        @Value("$" + "{gtd.sync-server.data-root}") String dataRoot
    ) {
        this(Path.of(dataRoot).resolve("google-calendar.properties"));
    }

    GoogleCalendarCredentialsStore(Path path) {
        this.path = path.toAbsolutePath().normalize();
    }

    public synchronized void saveClientCredentials(String clientId, String clientSecret) {
        Properties properties = read();
        properties.setProperty(CLIENT_ID, requireText("clientId", clientId));
        properties.setProperty(CLIENT_SECRET, requireText("clientSecret", clientSecret));
        clearToken(properties);
        write(properties);
    }

    public synchronized Optional<ClientCredentials> clientCredentials() {
        Properties properties = read();
        String clientId = properties.getProperty(CLIENT_ID);
        String clientSecret = properties.getProperty(CLIENT_SECRET);
        if (blank(clientId) || blank(clientSecret)) return Optional.empty();
        return Optional.of(new ClientCredentials(clientId, clientSecret));
    }

    public synchronized Optional<Token> token() {
        Properties properties = read();
        String accessToken = properties.getProperty(ACCESS_TOKEN);
        String refreshToken = properties.getProperty(REFRESH_TOKEN);
        if (blank(accessToken) && blank(refreshToken)) return Optional.empty();
        return Optional.of(readToken(properties, accessToken, refreshToken));
    }

    public synchronized void saveToken(Token token) {
        Properties properties = read();
        put(properties, ACCESS_TOKEN, token.accessToken());
        put(properties, REFRESH_TOKEN, token.refreshToken());
        put(properties, TOKEN_TYPE, token.tokenType());
        put(properties, SCOPE, token.scope());
        put(properties, EXPIRES_AT, token.expiresAt() == null ? null : token.expiresAt().toString());
        write(properties);
    }

    public synchronized void clearToken() {
        Properties properties = read();
        clearToken(properties);
        write(properties);
    }

    public synchronized String createOAuthState() {
        Properties properties = read();
        String state = UUID.randomUUID().toString();
        properties.setProperty(OAUTH_STATE, state);
        properties.setProperty(OAUTH_STATE_CREATED_AT, Instant.now().toString());
        write(properties);
        return state;
    }

    public synchronized boolean consumeOAuthState(String state) {
        Properties properties = read();
        if (!validState(properties, state)) return false;
        properties.remove(OAUTH_STATE);
        properties.remove(OAUTH_STATE_CREATED_AT);
        write(properties);
        return true;
    }

    public boolean credentialsConfigured() {
        return clientCredentials().isPresent();
    }

    public boolean connected() {
        return token().isPresent();
    }

    private boolean validState(Properties properties, String state) {
        if (blank(state) || !state.equals(properties.getProperty(OAUTH_STATE))) return false;
        Instant createdAt = parseInstant(properties.getProperty(OAUTH_STATE_CREATED_AT));
        return createdAt != null && createdAt.isAfter(Instant.now().minusSeconds(900));
    }

    private Token readToken(Properties properties, String accessToken, String refreshToken) {
        return new Token(
            accessToken,
            refreshToken,
            properties.getProperty(TOKEN_TYPE),
            properties.getProperty(SCOPE),
            parseInstant(properties.getProperty(EXPIRES_AT))
        );
    }

    private Properties read() {
        Properties properties = new Properties();
        if (!Files.exists(path)) return properties;
        try (Reader reader = Files.newBufferedReader(path)) {
            properties.load(reader);
            return properties;
        } catch (IOException exception) {
            throw failure("read", exception);
        }
    }

    private void write(Properties properties) {
        Path temporary = path.resolveSibling(path.getFileName() + ".tmp");
        try {
            Files.createDirectories(path.getParent());
            try (var writer = Files.newBufferedWriter(temporary)) {
                properties.store(writer, "GTD on Rails Google Calendar client state");
            }
            restrictPermissions(temporary);
            Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException exception) {
            throw failure("write", exception);
        }
    }

    private void restrictPermissions(Path target) {
        try {
            Files.setPosixFilePermissions(target, EnumSet.of(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE
            ));
        } catch (UnsupportedOperationException | IOException ignored) {
            // Non-POSIX filesystems keep their platform-default permissions.
        }
    }

    private void clearToken(Properties properties) {
        properties.remove(ACCESS_TOKEN);
        properties.remove(REFRESH_TOKEN);
        properties.remove(TOKEN_TYPE);
        properties.remove(SCOPE);
        properties.remove(EXPIRES_AT);
    }

    private void put(Properties properties, String key, String value) {
        if (blank(value)) properties.remove(key);
        else properties.setProperty(key, value);
    }

    private String requireText(String name, String value) {
        if (!blank(value)) return value.trim();
        throw new IllegalArgumentException(name + " value '" + value + "' is invalid; expected non-blank text");
    }

    private Instant parseInstant(String value) {
        if (blank(value)) return null;
        try {
            return Instant.parse(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private IllegalStateException failure(String action, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " Google Calendar client state at '" + path + "'",
            exception
        );
    }

    public record ClientCredentials(String clientId, String clientSecret) {
    }

    public record Token(
        String accessToken,
        String refreshToken,
        String tokenType,
        String scope,
        Instant expiresAt
    ) {
    }
}
