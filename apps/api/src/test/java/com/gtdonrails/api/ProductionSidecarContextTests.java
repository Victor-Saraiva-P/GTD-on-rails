package com.gtdonrails.api;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.nio.file.Path;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.WebApplicationType;
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
        String dataDir = tempDir.toString();
        assertDoesNotThrow(() -> {
            try (ConfigurableApplicationContext context = new SpringApplicationBuilder(ApiApplication.class)
                    .web(WebApplicationType.NONE)
                    .profiles("prod", "sidecar")
                    .run(
                        "--spring.datasource.url=jdbc:sqlite:file:testdb-prod-" + System.currentTimeMillis() + "?mode=memory&cache=shared",
                        "--spring.datasource.hikari.maximum-pool-size=1",
                        "--gtd.data.root-directory=" + dataDir,
                        "--gtd.sync.server.enabled=false"
                    )) {
                assertNotNull(context.getBean(ApiApplication.class));
            }
        });
    }
}
