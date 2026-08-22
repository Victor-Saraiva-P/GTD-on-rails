package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.config.FileSyncProperties;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.RcloneFileSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("bootstrap")
@EnableConfigurationProperties(FileSyncProperties.class)
public class BootstrapConfiguration {

    private static final Logger logger = LoggerFactory.getLogger(BootstrapConfiguration.class);

    private final ObjectMapper objectMapper;
    private final Path dataRoot;
    private final Path statusFile;
    private final boolean stagingReset;
    private String configurationStatus = "FAILED";
    private final CountDownLatch setupCompletion = new CountDownLatch(1);

    @Autowired
    public BootstrapConfiguration(
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${gtd.bootstrap.status-file}") String statusFile,
        @Value("${gtd.staging.reset:false}") boolean stagingReset
    ) {
        this(new ObjectMapper(), dataRoot, statusFile, stagingReset);
    }

    BootstrapConfiguration(
        ObjectMapper objectMapper,
        String dataRoot,
        String statusFile,
        boolean stagingReset
    ) {
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
        this.statusFile = Path.of(statusFile).toAbsolutePath().normalize();
        this.stagingReset = stagingReset;
    }

    /** Returns the system default clock for bootstrap timestamps.
     *
     * <p>Example: {@code configuration.clock()}.</p>
     */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }

    @Bean
    RcloneFileSyncService rcloneFileSyncService(FileSyncProperties properties) {
        return new RcloneFileSyncService(properties);
    }

    @Bean
    FileSyncService fileSyncService(
        FileSyncProperties properties,
        RcloneFileSyncService rcloneFileSyncService
    ) {
        return new FileSyncService(properties, rcloneFileSyncService, dataRoot.toString());
    }

    /**
     * Performs File Sync and publishes the configuration status for the desktop host.
     *
     * <p>Example: {@code bootstrapConfiguration.run(fileSyncService)}.</p>
     */
    public int run(FileSyncService fileSyncService) {
        try {
            if (!stagingReset) fileSyncService.syncOnStartup();
            configurationStatus = databaseConfigurationStatus();
            writeStatus(configurationStatus);
            return "READY".equals(configurationStatus) ? 0 : 2;
        } catch (RuntimeException | IOException exception) {
            logger.atError()
                .addKeyValue("event", "bootstrap_configuration_failed")
                .setCause(exception)
                .log("Bootstrap configuration failed");
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
            && isApplicationUser(properties.getProperty("spring.datasource.username"))
            && hasText(properties.getProperty("spring.datasource.password"));
    }

    /** Accepts "gtd_app" or "gtd_app.PROJECT_REF" (Supavisor tenant routing). */
    private boolean isApplicationUser(String username) {
        if (username == null) return false;
        return username.equals("gtd_app") || username.startsWith("gtd_app.");
    }

    private boolean validDatabaseUrl(String value) {
        return DatabaseConnectionUrl.isSupavisorSessionUrl(value);
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
