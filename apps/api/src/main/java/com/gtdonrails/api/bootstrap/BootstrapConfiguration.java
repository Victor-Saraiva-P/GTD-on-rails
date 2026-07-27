package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.io.BufferedReader;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.RcloneDataSyncService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("bootstrap")
@EnableConfigurationProperties(DataSyncProperties.class)
public class BootstrapConfiguration {

    private final ObjectMapper objectMapper;
    private final Path dataRoot;
    private final Path statusFile;
    private String configurationStatus = "FAILED";
    private final CountDownLatch setupCompletion = new CountDownLatch(1);

    public BootstrapConfiguration(
        ObjectMapper objectMapper,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${gtd.bootstrap.status-file}") String statusFile
    ) {
        this.objectMapper = objectMapper;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.statusFile = Path.of(statusFile).toAbsolutePath().normalize();
    }

    @Bean
    RcloneDataSyncService rcloneDataSyncService(DataSyncProperties properties) {
        return new RcloneDataSyncService(properties);
    }

    @Bean
    DataSyncService dataSyncService(
        DataSyncProperties properties,
        RcloneDataSyncService rcloneDataSyncService
    ) {
        return new DataSyncService(properties, rcloneDataSyncService, dataRoot.toString());
    }

    /**
     * Performs File Sync and publishes the configuration status for the desktop host.
     *
     * <p>Example: {@code bootstrapConfiguration.run(dataSyncService)}.</p>
     */
    public int run(DataSyncService dataSyncService) {
        try {
            dataSyncService.syncOnStartup();
            configurationStatus = databaseConfigurationStatus();
            writeStatus(configurationStatus);
            return "READY".equals(configurationStatus) ? 0 : 2;
        } catch (RuntimeException | IOException exception) {
            writeStatus("FAILED");
            return 1;
        }
    }

    /** Marks setup complete so the host can replace bootstrap with normal startup.
     *
     * <p>Example: {@code bootstrapConfiguration.markReady()}.</p>
     */
    public void markReady() {
        configurationStatus = "READY";
        writeStatus(configurationStatus);
        setupCompletion.countDown();
    }

    public boolean setupRequired() {
        return "MISSING".equals(configurationStatus);
    }

    /** Returns whether an existing configuration needs explicit administrative repair.
     *
     * <p>Example: {@code bootstrapConfiguration.repairRequired()}.</p>
     */
    public boolean repairRequired() {
        return "INVALID".equals(configurationStatus) || "REPAIR_FAILED".equals(configurationStatus);
    }

    /** Keeps the bootstrap sidecar available for another repair attempt.
     *
     * <p>Example: {@code bootstrapConfiguration.markRepairFailed()}.</p>
     */
    public void markRepairFailed() {
        configurationStatus = "REPAIR_FAILED";
        writeStatus(configurationStatus);
    }

    public String configurationStatus() {
        return configurationStatus;
    }

    public void awaitSetupCompletion() throws InterruptedException {
        setupCompletion.await();
    }

    private String databaseConfigurationStatus() throws IOException {
        Path configuration = dataRoot.resolve("database.properties");
        if (!Files.isRegularFile(configuration)) return "MISSING";
        Properties properties = new Properties();
        try (BufferedReader reader = Files.newBufferedReader(configuration)) {
            properties.load(reader);
        }
        return validDatabaseConfiguration(properties) ? "READY" : "INVALID";
    }

    private boolean validDatabaseConfiguration(Properties properties) {
        return validDatabaseUrl(properties.getProperty("spring.datasource.url"))
            && "gtd_app".equals(properties.getProperty("spring.datasource.username"))
            && hasText(properties.getProperty("spring.datasource.password"));
    }

    private boolean validDatabaseUrl(String value) {
        if (!hasText(value) || !value.startsWith("jdbc:postgresql://")) return false;
        try {
            URI parsed = URI.create(value.substring("jdbc:".length()));
            return hasText(parsed.getHost()) && parsed.getPath() != null && parsed.getPath().length() > 1;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void writeStatus(String configurationStatus) {
        try {
            Files.createDirectories(statusFile.getParent());
            objectMapper.writeValue(statusFile.toFile(),
                new BootstrapStatus(configurationStatus));
        } catch (IOException exception) {
            throw new IllegalStateException("bootstrap status file value '" + statusFile + "' is invalid; expected writable JSON file", exception);
        }
    }

    private record BootstrapStatus(String configurationStatus) {
    }
}
