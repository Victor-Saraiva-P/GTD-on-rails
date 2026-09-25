package com.gtdonrails.api;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
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
    void productionSidecarContextLoadsWithoutMissingBeans() {
        assertDoesNotThrow(() -> {
            try (ConfigurableApplicationContext context = new SpringApplicationBuilder(ApiApplication.class)
                    .web(WebApplicationType.NONE)
                    .profiles("prod", "sidecar")
                    .properties(
                        "spring.datasource.url=jdbc:sqlite:file:testdb-prod-check?mode=memory&cache=shared",
                        "gtd.sync.server.enabled=false"
                    )
                    .run()) {
                // Production sidecar context successfully loaded
            }
        });
    }
}
