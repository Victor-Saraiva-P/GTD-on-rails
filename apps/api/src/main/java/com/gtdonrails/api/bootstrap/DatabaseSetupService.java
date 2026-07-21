package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.security.SecureRandom;
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
    private final String environment;

    public DatabaseSetupService(
        @Value("${gtd.data.root-directory}") String dataRoot,
        DataSyncService fileSync,
        @Value("${gtd.database.environment:PRODUCTION}") String environment
    ) {
        configurationPath = Path.of(dataRoot).toAbsolutePath().normalize().resolve("database.properties");
        this.fileSync = fileSync;
        this.environment = environment;
    }

    /** Provisions the limited application role and saves its connection details.
     *
     * <p>Example: {@code setupService.provision(request)}.</p>
     */
    public void provision(DatabaseSetupRequest request) {
        validate(request);
        String password = generatedPassword();
        try (Connection connection = DriverManager.getConnection(
            request.administrativeUrl(), request.administrativeUsername(), request.administrativePassword())) {
            provisionDatabase(connection, password);
            saveConfiguration(request.administrativeUrl(), password);
            fileSync.requestManualSync();
        } catch (SQLException | IOException exception) {
            throw new IllegalStateException("database setup failed for administrative URL '" + request.administrativeUrl() + "'", exception);
        }
    }

    private void validate(DatabaseSetupRequest request) {
        if (request == null || blank(request.administrativeUrl()) || blank(request.administrativeUsername())
            || blank(request.administrativePassword())) {
            throw new IllegalArgumentException("database setup request value is incomplete; expected URL, username, and password");
        }
        if (!request.administrativeUrl().startsWith("jdbc:postgresql://")
            || !request.administrativeUrl().contains("sslmode=verify-full")) {
            throw new IllegalArgumentException("administrative URL value '" + request.administrativeUrl() + "' is invalid; expected PostgreSQL URL with sslmode=verify-full");
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
        }
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
