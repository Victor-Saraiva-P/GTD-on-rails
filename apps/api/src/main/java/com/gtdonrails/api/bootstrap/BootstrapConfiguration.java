package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

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
            String status = databaseConfigurationStatus();
            writeStatus(status);
            return "READY".equals(status) ? 0 : 2;
        } catch (RuntimeException | IOException exception) {
            writeStatus("FAILED");
            return 1;
        }
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
        return hasText(properties.getProperty("spring.datasource.url"))
            && properties.getProperty("spring.datasource.url").startsWith("jdbc:postgresql://")
            && hasText(properties.getProperty("spring.datasource.username"))
            && hasText(properties.getProperty("spring.datasource.password"));
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
