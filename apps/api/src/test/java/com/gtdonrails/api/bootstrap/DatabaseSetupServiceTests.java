package com.gtdonrails.api.bootstrap;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Properties;

import com.gtdonrails.api.config.FileSyncProperties;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.RcloneFileSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DatabaseSetupServiceTests {

    @TempDir
    private Path tempDir;

    @Test
    void acceptsSupavisorSessionUrlWithFullTlsVerification() {
        assertTrue(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full"));
    }

    @Test
    void rejectsSupavisorTransactionModeUrl() {
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full"));
    }

    @Test
    void rejectsRemoteUrlWithoutFullTlsVerification() {
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"));
    }

    @Test
    void rejectsAdministrativeUrlThatContainsCredentials() {
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://admin:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full"));
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&password=secret"));
    }

    @Test
    void provisionStoresLimitedCredentialsAndSynchronizesConfiguration() throws Exception {
        FileSyncService fileSync = mock(FileSyncService.class);
        DatabaseSetupService service = new DatabaseSetupService(tempDir.toString(), fileSync,
            new FakeDatabaseConnectionFactory(provisioningConnection()), "PRODUCTION");

        service.provision(request("aws-0-us-east-1.pooler.supabase.com"));

        Properties configuration = readConfiguration();
        assertEquals("gtd_app", configuration.getProperty("spring.datasource.username"));
        assertTrue(configuration.getProperty("spring.datasource.password").length() > 20);
        assertTrue(configuration.getProperty("spring.datasource.url").contains("currentSchema=gtd"));
        verify(fileSync).syncNow();
    }

    @Test
    void provisionRecordsAwaitingLegacyImportWhenLegacySqliteExistsInProduction() throws Exception {
        Files.createFile(tempDir.resolve("gtd-on-rails.db"));
        FileSyncService fileSync = mock(FileSyncService.class);
        Connection connection = provisioningConnection();
        Statement statement = connection.createStatement();
        DatabaseSetupService service = new DatabaseSetupService(tempDir.toString(), fileSync,
            new FakeDatabaseConnectionFactory(connection), "PRODUCTION");

        service.provision(request("aws-0-us-east-1.pooler.supabase.com"));

        verify(statement).execute("INSERT INTO gtd.database_cutover (state) VALUES ('AWAITING_LEGACY_IMPORT') ON CONFLICT (id) DO NOTHING");
        verify(statement).execute("GRANT SELECT, INSERT, UPDATE ON gtd.database_identity, gtd.database_cutover TO gtd_app");
    }

    @Test
    void provisionRecordsReadyWhenSqliteDoesNotExistInProduction() throws Exception {
        FileSyncService fileSync = mock(FileSyncService.class);
        Connection connection = provisioningConnection();
        Statement statement = connection.createStatement();
        DatabaseSetupService service = new DatabaseSetupService(tempDir.toString(), fileSync,
            new FakeDatabaseConnectionFactory(connection), "PRODUCTION");

        service.provision(request("aws-0-us-east-1.pooler.supabase.com"));

        verify(statement).execute("INSERT INTO gtd.database_cutover (state) VALUES ('READY') ON CONFLICT (id) DO NOTHING");
        verify(statement).execute("GRANT SELECT, INSERT, UPDATE ON gtd.database_identity, gtd.database_cutover TO gtd_app");
    }

    @Test
    void provisionFailsWithUnderlyingCauseMessageWhenConnectionFails() {
        FakeDatabaseConnectionFactory factory = new FakeDatabaseConnectionFactory();
        factory.failure = new SQLException("password authentication failed for user postgres");
        DatabaseSetupService service = service(factory);

        IllegalStateException exception = assertThrows(IllegalStateException.class,
            () -> service.provision(request("aws-0-us-east-1.pooler.supabase.com")));

        assertTrue(exception.getMessage().contains("password authentication failed for user postgres"));
    }

    @Test
    void repairRejectsAnAdministrativeConnectionForAnotherDatabaseBeforeChangingConfiguration() throws Exception {
        Path configuration = tempDir.resolve("database.properties");
        Files.writeString(configuration, runtimeConfiguration("old-secret"));
        FakeDatabaseConnectionFactory factory = new FakeDatabaseConnectionFactory();
        DatabaseSetupService service = service(factory);
        DatabaseSetupRequest request = request("aws-0-us-west-1.pooler.supabase.com");
        DatabaseRepairException exception = assertThrows(DatabaseRepairException.class, () -> service.repair(request));

        assertTrue(exception.getMessage().contains("expected existing target"));
        assertArrayEquals(new char[] {'\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0'}, request.administrativePassword());
        assertArrayEquals("old-secret".getBytes(StandardCharsets.UTF_8), readConfiguration().getProperty("spring.datasource.password").getBytes(StandardCharsets.UTF_8));
        assertEquals(0, factory.openCalls);
    }

    @Test
    void repairRejectsAnEnvironmentMismatchBeforeRotatingTheRole() throws Exception {
        Path configuration = tempDir.resolve("database.properties");
        Files.writeString(configuration, runtimeConfiguration("old-secret"));
        Connection connection = verifiedConnection("STAGING");
        FakeDatabaseConnectionFactory factory = new FakeDatabaseConnectionFactory(connection);
        DatabaseSetupService service = service(factory);

        DatabaseSetupRequest request = request("aws-0-us-east-1.pooler.supabase.com");

        assertThrows(DatabaseRepairException.class, () -> service.repair(request));

        verify(connection.createStatement()).executeQuery(anyString());
        verify(connection.createStatement(), never()).execute(anyString());
        assertEquals("old-secret", readConfiguration().getProperty("spring.datasource.password"));
    }

    @Test
    void repairVerifiesTheRotatedLimitedCredentialBeforePublishingIt() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), runtimeConfiguration("old-secret"));
        Connection connection = verifiedConnection("PRODUCTION");
        FakeDatabaseConnectionFactory factory = new FakeDatabaseConnectionFactory(connection);
        DatabaseSetupService service = service(factory);
        char[] administrativePassword = "admin-secret".toCharArray();

        service.repair(new DatabaseSetupRequest(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
            "postgres",
            administrativePassword));

        assertArrayEquals(new char[] {'\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0', '\0'}, administrativePassword);
        assertEquals("gtd_app", readConfiguration().getProperty("spring.datasource.username"));
        assertNotEquals("old-secret", readConfiguration().getProperty("spring.datasource.password"));
        verify(connection.createStatement(), times(2)).executeQuery(anyString());
    }

    @Test
    void repairLeavesConfigurationUntouchedWhenAdministrativeConnectionTemporarilyFails() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), runtimeConfiguration("old-secret"));
        FakeDatabaseConnectionFactory factory = new FakeDatabaseConnectionFactory();
        factory.failure = new SQLException("temporary connection failure for password admin-secret");
        DatabaseSetupService service = service(factory);

        DatabaseSetupRequest request = request("aws-0-us-east-1.pooler.supabase.com");

        DatabaseRepairException exception = assertThrows(DatabaseRepairException.class, () -> service.repair(request));

        assertFalse(exception.getMessage().contains("admin-secret"));
        assertEquals("old-secret", readConfiguration().getProperty("spring.datasource.password"));
    }

    @Test
    void repairRestoresThePreviousRoleWhenVerificationOfTheNewRoleFails() throws Exception {
        Files.writeString(tempDir.resolve("database.properties"), runtimeConfiguration("old-secret"));
        Connection administrative = verifiedConnection("PRODUCTION");
        Connection limited = verifiedConnection("STAGING");
        DatabaseSetupService service = service(new FakeDatabaseConnectionFactory(administrative, limited));

        DatabaseSetupRequest request = request("aws-0-us-east-1.pooler.supabase.com");

        assertThrows(DatabaseRepairException.class, () -> service.repair(request));

        verify(administrative.createStatement(), times(2)).execute(anyString());
        assertEquals("old-secret", readConfiguration().getProperty("spring.datasource.password"));
    }

    private DatabaseSetupService service() {
        return service(new FakeDatabaseConnectionFactory());
    }

    private DatabaseSetupService service(DatabaseConnectionFactory factory) {
        FileSyncProperties properties = new FileSyncProperties();
        FileSyncService fileSync = new FileSyncService(
            properties, new RcloneFileSyncService(properties), tempDir.toString());
        return new DatabaseSetupService(tempDir.toString(), fileSync, factory, "PRODUCTION");
    }

    private DatabaseSetupRequest request(String host) {
        return new DatabaseSetupRequest(
            "jdbc:postgresql://" + host + ":5432/postgres?sslmode=verify-full",
            "postgres",
            "admin-secret".toCharArray());
    }

    private String runtimeConfiguration(String password) {
        return "spring.datasource.url=jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&currentSchema=gtd\n"
            + "spring.datasource.username=gtd_app\n"
            + "spring.datasource.password=" + password + "\n";
    }

    private Properties readConfiguration() throws Exception {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(tempDir.resolve("database.properties"))) {
            properties.load(reader);
        }
        return properties;
    }

    private Connection verifiedConnection(String environment) throws Exception {
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        ResultSet result = mock(ResultSet.class);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(result);
        when(result.next()).thenReturn(true);
        when(result.getString(1)).thenReturn("postgres", "PRODUCTION");
        when(result.getBoolean(2)).thenReturn(true);
        when(result.getString(3)).thenReturn(environment);
        return connection;
    }

    private Connection provisioningConnection() throws Exception {
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        ResultSet result = mock(ResultSet.class);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(result);
        return connection;
    }

    private static class FakeDatabaseConnectionFactory implements DatabaseConnectionFactory {

        private final Connection[] connections;
        private int openCalls;
        private SQLException failure;

        private FakeDatabaseConnectionFactory() {
            this.connections = new Connection[0];
        }

        private FakeDatabaseConnectionFactory(Connection connection) {
            this(new Connection[] {connection});
        }

        private FakeDatabaseConnectionFactory(Connection... connections) {
            this.connections = connections;
        }

        @Override
        public Connection open(String url, String username, char[] password) throws SQLException {
            openCalls++;
            if (failure != null) throw failure;
            if (connections.length == 0) throw new UnsupportedOperationException("fake connection value is missing; expected configured connection");
            return connections[Math.min(openCalls - 1, connections.length - 1)];
        }
    }
}
