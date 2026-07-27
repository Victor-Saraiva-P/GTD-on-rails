package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.EnumSet;
import java.util.Properties;

import com.gtdonrails.api.services.DataSyncService;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;

@Service
@Profile("bootstrap")
public class DatabaseSetupService {

    private static final String APPLICATION_USER = "gtd_app";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Path configurationPath;
    private final DataSyncService fileSync;
    private final DatabaseConnectionFactory connectionFactory;
    private final String environment;

    public DatabaseSetupService(
        @Value("${gtd.data.root-directory}") String dataRoot,
        DataSyncService fileSync,
        DatabaseConnectionFactory connectionFactory,
        @Value("${gtd.database.environment:PRODUCTION}") String environment
    ) {
        configurationPath = Path.of(dataRoot).toAbsolutePath().normalize().resolve("database.properties");
        this.fileSync = fileSync;
        this.connectionFactory = connectionFactory;
        this.environment = environment;
    }

    /** Provisions the limited application role and saves its connection details.
     *
     * <p>Example: {@code setupService.provision(request)}.</p>
     */
    public void provision(DatabaseSetupRequest request) {
        validate(request);
        String password = generatedPassword();
        try {
            try (Connection connection = connectionFactory.open(
                request.administrativeUrl(), request.administrativeUsername(), request.administrativePassword())) {
                provisionDatabase(connection, password);
                saveConfiguration(request.administrativeUrl(), password);
                fileSync.syncNow();
            }
        } catch (SQLException | IOException exception) {
            throw new IllegalStateException("database setup failed for administrative URL '" + request.administrativeUrl() + "'", exception);
        } finally {
            Arrays.fill(request.administrativePassword(), '\0');
        }
    }

    private void validate(DatabaseSetupRequest request) {
        if (request == null || blank(request.administrativeUrl()) || blank(request.administrativeUsername())
            || request.administrativePassword() == null || request.administrativePassword().length == 0) {
            throw new IllegalArgumentException("database setup request value is incomplete; expected URL, username, and password");
        }
        if (!isSupavisorSessionUrl(request.administrativeUrl())) {
            throw new IllegalArgumentException("administrative URL value '" + request.administrativeUrl() + "' is invalid; expected PostgreSQL Supavisor session URL with sslmode=verify-full");
        }
    }

    boolean isSupavisorSessionUrl(String url) {
        try {
            java.net.URI parsed = java.net.URI.create(url.substring("jdbc:".length()));
            return "postgresql".equals(parsed.getScheme()) && parsed.getPort() == 5432
                && parsed.getHost() != null && parsed.getHost().endsWith(".pooler.supabase.com")
                && Arrays.stream(parsed.getQuery().split("&"))
                    .anyMatch(parameter -> parameter.equals("sslmode=verify-full"));
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private void provisionDatabase(Connection connection, String password) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA IF NOT EXISTS gtd");
            statement.execute("CREATE ROLE " + APPLICATION_USER + " LOGIN PASSWORD '" + password + "'");
            statement.execute("ALTER SCHEMA gtd OWNER TO " + APPLICATION_USER);
            statement.execute("GRANT USAGE, CREATE ON SCHEMA gtd TO " + APPLICATION_USER);
            statement.execute("REVOKE ALL ON SCHEMA public FROM " + APPLICATION_USER);
            statement.execute("ALTER ROLE " + APPLICATION_USER + " NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
            provisionEnvironmentIdentity(statement);
        }
    }

    private void provisionEnvironmentIdentity(Statement statement) throws SQLException {
        if (!isKnownEnvironment(environment)) {
            throw new IllegalArgumentException("database environment value '" + environment + "' is invalid; expected PRODUCTION or STAGING");
        }
        statement.execute("CREATE TABLE IF NOT EXISTS gtd.database_identity (id boolean PRIMARY KEY DEFAULT true CHECK (id), environment text NOT NULL CHECK (environment IN ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST')))");
        statement.execute("INSERT INTO gtd.database_identity (environment) VALUES ('" + environment + "') ON CONFLICT (id) DO NOTHING");
        statement.execute("CREATE TABLE IF NOT EXISTS gtd.database_cutover (id boolean PRIMARY KEY DEFAULT true CHECK (id), state text NOT NULL CHECK (state IN ('AWAITING_LEGACY_IMPORT', 'IMPORTING', 'READY', 'FAILED')))");
        statement.execute("INSERT INTO gtd.database_cutover (state) VALUES ('READY') ON CONFLICT (id) DO NOTHING");
        try (var result = statement.executeQuery("SELECT environment FROM gtd.database_identity WHERE id = true")) {
            if (result.next() && !environment.equals(result.getString(1))) {
                throw new IllegalStateException("database environment value '" + result.getString(1) + "' is invalid; expected " + environment);
            }
        }
        statement.execute("GRANT SELECT, INSERT ON gtd.database_identity, gtd.database_cutover TO " + APPLICATION_USER);
    }

    private boolean isKnownEnvironment(String value) {
        return "PRODUCTION".equals(value) || "STAGING".equals(value);
    }

    private void saveConfiguration(String url, String password) throws IOException {
        Files.createDirectories(configurationPath.getParent());
        Properties properties = new Properties();
        properties.setProperty("spring.datasource.url", url + (url.contains("?") ? "&" : "?") + "currentSchema=gtd");
        properties.setProperty("spring.datasource.username", APPLICATION_USER);
        properties.setProperty("spring.datasource.password", password);
        properties.setProperty("spring.flyway.placeholders.databaseIdentity", environment);
        Path temporary = Files.createTempFile(configurationPath.getParent(), "database", ".properties");
        try {
            writeLimitedConfiguration(temporary, properties);
            replaceConfiguration(temporary);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void writeLimitedConfiguration(Path temporary, Properties properties) throws IOException {
        try (var writer = Files.newBufferedWriter(temporary, StandardCharsets.UTF_8)) {
            properties.store(writer, "GTD on Rails limited database connection");
        }
        Files.setPosixFilePermissions(temporary, EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
    }

    private void replaceConfiguration(Path temporary) throws IOException {
        Files.move(temporary, configurationPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
    }

    private String generatedPassword() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
}
