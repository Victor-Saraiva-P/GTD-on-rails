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

import com.gtdonrails.api.services.FileSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;

@Service
@Profile("bootstrap")
public class DatabaseSetupService {

    private static final String APPLICATION_USER = "gtd_app";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Path configurationPath;
    private final FileSyncService fileSync;
    private final DatabaseConnectionFactory connectionFactory;
    private final String environment;
    private final DatabaseTrustCertificateProvisioner certificateProvisioner;

    @Autowired
    public DatabaseSetupService(
        @Value("${gtd.data.root-directory}") String dataRoot,
        FileSyncService fileSync,
        DatabaseConnectionFactory connectionFactory,
        @Value("${gtd.database.environment:PRODUCTION}") String environment
    ) {
        this(dataRoot, fileSync, connectionFactory, environment, new DatabaseTrustCertificateProvisioner());
    }

    public DatabaseSetupService(
        String dataRoot,
        FileSyncService fileSync,
        DatabaseConnectionFactory connectionFactory,
        String environment,
        DatabaseTrustCertificateProvisioner certificateProvisioner
    ) {
        configurationPath = Path.of(dataRoot).toAbsolutePath().normalize().resolve("database.properties");
        this.fileSync = fileSync;
        this.connectionFactory = connectionFactory;
        this.environment = environment;
        this.certificateProvisioner = certificateProvisioner != null ? certificateProvisioner : new DatabaseTrustCertificateProvisioner();
    }

    /** Provisions the limited application role and saves its connection details.
     *
     * <p>Example: {@code setupService.provision(request)}.</p>
     */
    public void provision(DatabaseSetupRequest request) {
        try {
            validate(request);
            certificateProvisioner.ensureCertificate(configurationPath.getParent());
            String password = generatedPassword();
            try (Connection connection = connectionFactory.open(
                request.administrativeUrl(), request.administrativeUsername(), request.administrativePassword())) {
                provisionDatabase(connection, password);
                saveConfiguration(request.administrativeUrl(), request.administrativeUsername(), password);
                fileSync.syncNow();
            }
        } catch (SQLException | IOException exception) {
            throw new IllegalStateException("database setup failed for administrative URL '" + redactedUrl(request.administrativeUrl()) + "'; expected successful database provisioning (" + exception.getMessage() + ")", exception);
        } finally {
            clearAdministrativePassword(request);
        }
    }

    /** Repairs a broken limited role without replacing configuration before verification.
     *
     * <p>Example: {@code setupService.repair(request)}.</p>
     */
    public void repair(DatabaseSetupRequest request) {
        try {
            validate(request);
            certificateProvisioner.ensureCertificate(configurationPath.getParent());
            RepairData repairData = loadRepairData(request);
            String password = generatedPassword();
            executeRepair(request, password, repairData);
        } catch (SQLException | IOException | RuntimeException exception) {
            throw repairFailure(request == null ? null : request.administrativeUrl(), exception);
        } finally {
            clearAdministrativePassword(request);
        }
    }

    private RepairData loadRepairData(DatabaseSetupRequest request) {
        byte[] original = readExistingConfiguration(configurationPath);
        Properties existing = existingProperties(configurationPath);
        String existingUrl = getSupabaseProperty(existing, "url");
        String existingPassword = getSupabaseProperty(existing, "password");
        validateSameTargetIfKnown(request.administrativeUrl(), existingUrl);
        requirePreviousPassword(existingPassword);
        return new RepairData(original, existingPassword);
    }

    private String getSupabaseProperty(Properties properties, String key) {
        String value = properties.getProperty("spring.datasource.supabase." + key);
        if (value != null) return value;
        return properties.getProperty("spring.datasource." + key);
    }

    private void executeRepair(DatabaseSetupRequest request, String password, RepairData repairData) throws SQLException, IOException {
        try (Connection connection = openAdministrativeConnection(request)) {
            validateRepairTarget(connection, request.administrativeUrl());
            rotateAndVerifyRole(connection, request.administrativeUrl(), request.administrativeUsername(), password, repairData.previousPassword());
            replaceAndSyncConfiguration(repairData.original(), request.administrativeUrl(), request.administrativeUsername(), password, connection, repairData.previousPassword());
        }
    }

    private void validate(DatabaseSetupRequest request) {
        if (request == null || blank(request.administrativeUrl()) || blank(request.administrativeUsername())
            || request.administrativePassword() == null || request.administrativePassword().length == 0) {
            throw new IllegalArgumentException("database setup request value is incomplete; expected URL, username, and password");
        }
        if (!isSupavisorSessionUrl(request.administrativeUrl())) {
            throw new IllegalArgumentException("administrative URL value '" + redactedUrl(request.administrativeUrl()) + "' is invalid; expected PostgreSQL Supavisor session URL with sslmode=verify-full");
        }
    }

    boolean isSupavisorSessionUrl(String url) {
        return DatabaseConnectionUrl.isSupavisorSessionUrl(url);
    }

    private Connection openAdministrativeConnection(DatabaseSetupRequest request) throws SQLException {
        return connectionFactory.open(request.administrativeUrl(), request.administrativeUsername(), request.administrativePassword());
    }

    private byte[] readExistingConfiguration(Path path) {
        try {
            if (!Files.isRegularFile(path)) throw new IOException("missing file");
            return Files.readAllBytes(path);
        } catch (IOException exception) {
            throw new DatabaseRepairException("database configuration value '" + path + "' is invalid; expected an existing file", exception);
        }
    }

    private Properties existingProperties(Path path) {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(path)) {
            properties.load(reader);
        } catch (IOException exception) {
            throw new DatabaseRepairException("database configuration value '" + path + "' is invalid; expected readable properties", exception);
        }
        return properties;
    }

    private void validateSameTargetIfKnown(String administrativeUrl, String existingUrl) {
        if (blank(existingUrl) || !isSupavisorSessionUrl(existingUrl)) return;
        if (!databaseTarget(administrativeUrl).equals(databaseTarget(existingUrl))) {
            throw new DatabaseRepairException("database repair target value '" + redactedUrl(administrativeUrl) + "' is invalid; expected existing target '" + databaseTarget(existingUrl) + "'");
        }
    }

    private void requirePreviousPassword(String password) {
        if (blank(password)) {
            throw new DatabaseRepairException("database configuration password value is invalid; expected existing limited role password");
        }
    }

    private String databaseTarget(String url) {
        return DatabaseConnectionUrl.target(url);
    }

    private void validateRepairTarget(Connection connection, String administrativeUrl) throws SQLException {
        try (Statement statement = connection.createStatement(); var result = statement.executeQuery("SELECT current_database(), EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'gtd'), (SELECT environment FROM gtd.database_identity WHERE id = true)")) {
            if (!result.next()) throw new SQLException("database repair target returned no identity");
            String target = DatabaseConnectionUrl.target(administrativeUrl);
            String database = target.substring(target.lastIndexOf('/') + 1);
            if (!database.equals(result.getString(1))) throw new DatabaseRepairException("database repair database value '" + result.getString(1) + "' is invalid; expected '" + database + "'");
            if (!result.getBoolean(2)) throw new DatabaseRepairException("database repair schema value 'gtd' is invalid; expected existing application schema");
            if (!environment.equals(result.getString(3))) throw new DatabaseRepairException("database identity value '" + result.getString(3) + "' is invalid; expected '" + environment + "'");
        }
    }

    @SuppressWarnings("java:S2077") // PostgreSQL does not permit bind parameters for ALTER ROLE passwords.
    private void rotateApplicationRole(Connection connection, String password) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER ROLE " + APPLICATION_USER + " PASSWORD " + sqlLiteral(password));
        }
    }

    private void rotateAndVerifyRole(Connection connection, String url, String administrativeUsername, String password, String previousPassword) throws SQLException {
        rotateApplicationRole(connection, password);
        try {
            verifyLimitedConnection(url, administrativeUsername, password);
        } catch (SQLException | RuntimeException exception) {
            rotateApplicationRole(connection, previousPassword);
            throw exception;
        }
    }

    private void replaceAndSyncConfiguration(byte[] original, String url, String administrativeUsername, String password, Connection connection, String previousPassword) throws IOException, SQLException {
        try {
            saveConfiguration(url, administrativeUsername, password);
            fileSync.syncNow();
        } catch (IOException | RuntimeException exception) {
            restoreConfiguration(original);
            rotateApplicationRole(connection, previousPassword);
            throw exception;
        }
    }

    private void verifyLimitedConnection(String url, String administrativeUsername, String password) throws SQLException {
        String runtimeUser = supavisorUsername(administrativeUsername);
        try (Connection connection = connectionFactory.open(url, runtimeUser, password.toCharArray()); Statement statement = connection.createStatement(); var result = statement.executeQuery("SELECT environment FROM gtd.database_identity WHERE id = true")) {
            if (!result.next() || !environment.equals(result.getString(1))) throw new DatabaseRepairException("database identity value is invalid; expected '" + environment + "'");
        }
    }

    private String sqlLiteral(String value) {
        return "'" + value.replace("'", "''") + "'";
    }

    private void restoreConfiguration(byte[] original) throws IOException {
        Files.write(configurationPath, original);
        Files.setPosixFilePermissions(configurationPath, EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
    }

    private DatabaseRepairException repairFailure(String url, Exception cause) {
        if (cause instanceof DatabaseRepairException repairException) return repairException;
        return new DatabaseRepairException("database repair failed for administrative URL '" + redactedUrl(url) + "'; expected verified limited configuration", cause);
    }

    private String redactedUrl(String url) {
        return DatabaseConnectionUrl.redacted(url);
    }

    private void clearAdministrativePassword(DatabaseSetupRequest request) {
        if (request == null || request.administrativePassword() == null) return;
        Arrays.fill(request.administrativePassword(), '\0');
    }

    private record RepairData(byte[] original, String previousPassword) {
    }

    private void provisionDatabase(Connection connection, String password) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA IF NOT EXISTS gtd");
            provisionApplicationRole(statement, password);
            // WHY: Supabase's CREATEROLE doesn't auto-grant membership in the created role,
            // so the admin user can't SET ROLE gtd_app (needed by ALTER SCHEMA ... OWNER TO).
            grantApplicationRoleToCurrentUser(statement);
            statement.execute("ALTER SCHEMA gtd OWNER TO " + APPLICATION_USER);
            statement.execute("GRANT USAGE, CREATE ON SCHEMA gtd TO " + APPLICATION_USER);
            statement.execute("REVOKE ALL ON SCHEMA public FROM " + APPLICATION_USER);
            provisionEnvironmentIdentity(statement);
        }
    }

    private void grantApplicationRoleToCurrentUser(Statement statement) throws SQLException {
        statement.execute("GRANT " + APPLICATION_USER + " TO CURRENT_USER");
    }

    private void provisionApplicationRole(Statement statement, String password) throws SQLException {
        statement.execute("DO $$\n"
            + "BEGIN\n"
            + "    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" + APPLICATION_USER + "') THEN\n"
            + "        CREATE ROLE " + APPLICATION_USER + " LOGIN PASSWORD " + sqlLiteral(password) + " NOCREATEDB NOCREATEROLE NOREPLICATION;\n"
            + "    ELSE\n"
            + "        ALTER ROLE " + APPLICATION_USER + " WITH LOGIN PASSWORD " + sqlLiteral(password) + " NOCREATEDB NOCREATEROLE NOREPLICATION;\n"
            + "    END IF;\n"
            + "END\n"
            + "$$;");
    }

    private void provisionEnvironmentIdentity(Statement statement) throws SQLException {
        if (!isKnownEnvironment(environment)) {
            throw new IllegalArgumentException("database environment value '" + environment + "' is invalid; expected PRODUCTION or STAGING");
        }
        statement.execute("CREATE TABLE IF NOT EXISTS gtd.database_identity (id boolean PRIMARY KEY DEFAULT true CHECK (id), environment text NOT NULL CHECK (environment IN ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST')))");
        statement.execute("INSERT INTO gtd.database_identity (environment) VALUES ('" + environment + "') ON CONFLICT (id) DO NOTHING");
        statement.execute("CREATE TABLE IF NOT EXISTS gtd.database_cutover (id boolean PRIMARY KEY DEFAULT true CHECK (id), state text NOT NULL CHECK (state IN ('AWAITING_LEGACY_IMPORT', 'IMPORTING', 'READY', 'FAILED')))");
        statement.execute("INSERT INTO gtd.database_cutover (state) VALUES ('" + initialCutoverState() + "') ON CONFLICT (id) DO NOTHING");
        try (var result = statement.executeQuery("SELECT environment FROM gtd.database_identity WHERE id = true")) {
            if (result.next() && !environment.equals(result.getString(1))) {
                throw new IllegalStateException("database environment value '" + result.getString(1) + "' is invalid; expected " + environment);
            }
        }
        statement.execute("GRANT SELECT, INSERT, UPDATE ON gtd.database_identity, gtd.database_cutover TO " + APPLICATION_USER);
    }

    private String initialCutoverState() {
        if ("PRODUCTION".equals(environment) && Files.exists(configurationPath.getParent().resolve("gtd-on-rails.db"))) {
            return "AWAITING_LEGACY_IMPORT";
        }
        return "READY";
    }

    private boolean isKnownEnvironment(String value) {
        return "PRODUCTION".equals(value) || "STAGING".equals(value);
    }

    private void saveConfiguration(String url, String administrativeUsername, String password) throws IOException {
        Files.createDirectories(configurationPath.getParent());
        certificateProvisioner.ensureCertificate(configurationPath.getParent());
        Properties properties = new Properties();
        properties.setProperty("spring.datasource.supabase.url", DatabaseConnectionUrl.runtimeUrl(url));
        // WHY: Supavisor requires the project ref suffix on every username for tenant routing.
        // The admin username is "postgres.PROJECT_REF"; we reuse the same suffix for gtd_app.
        properties.setProperty("spring.datasource.supabase.username", supavisorUsername(administrativeUsername));
        properties.setProperty("spring.datasource.supabase.password", password);
        properties.setProperty("spring.flyway.placeholders.databaseIdentity", environment);
        Path temporary = Files.createTempFile(configurationPath.getParent(), "database", ".properties");
        try {
            writeLimitedConfiguration(temporary, properties);
            replaceConfiguration(temporary);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    /** Builds a Supavisor-routable username from the administrative username's project ref.
     *
     * <p>Example: {@code supavisorUsername("postgres.abc123")} returns {@code "gtd_app.abc123"}.</p>
     */
    private String supavisorUsername(String administrativeUsername) {
        int dot = administrativeUsername.indexOf('.');
        if (dot < 0) return APPLICATION_USER;
        return APPLICATION_USER + administrativeUsername.substring(dot);
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
