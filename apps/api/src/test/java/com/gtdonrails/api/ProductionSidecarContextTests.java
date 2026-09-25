package com.gtdonrails.api;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.nio.file.Path;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

@Tag("integration")
class ProductionSidecarContextTests {

    /** Verifies that the Spring Boot production sidecar context initializes without missing beans.
     *
     * <p>Example: prevents UnsatisfiedDependencyException on prod startup.</p>
     */
    @Test
    void productionSidecarContextLoadsWithoutMissingBeans(@TempDir Path tempDir) {
        String dataDir = tempDir.resolve("data").toString();
        assertDoesNotThrow(() -> {
            try (ConfigurableApplicationContext context = new SpringApplicationBuilder(ApiApplication.class)
                    .profiles("prod", "sidecar")
                    .properties(
                        "server.port=0",
                        "gtd.data.root-directory=" + dataDir,
                        "gtd.sync.server.enabled=false"
                    )
                    .run()) {
                // Production sidecar context successfully loaded
            }
        });
    }
}
