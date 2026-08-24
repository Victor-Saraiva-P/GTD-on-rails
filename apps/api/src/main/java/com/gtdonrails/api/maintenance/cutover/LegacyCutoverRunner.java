package com.gtdonrails.api.maintenance.cutover;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("cutover")
public class LegacyCutoverRunner implements ApplicationRunner {

    private final LegacyDatabaseCutoverService cutoverService;
    private final ConfigurableApplicationContext context;

    public LegacyCutoverRunner(LegacyDatabaseCutoverService cutoverService, ConfigurableApplicationContext context) {
        this.cutoverService = cutoverService;
        this.context = context;
    }

    /**
     * Runs the legacy SQLite database cutover upon application startup with profile cutover.
     *
     * <p>Example: {@code legacyCutoverRunner.run(args)}.</p>
     */
    @Override
    public void run(ApplicationArguments args) {
        cutoverService.executeCutover();
        context.close();
    }
}
