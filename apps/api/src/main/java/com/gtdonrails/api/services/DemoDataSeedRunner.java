package com.gtdonrails.api.services;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
public class DemoDataSeedRunner implements ApplicationRunner {

    private final DemoDataSeedService demoDataSeedService;

    public DemoDataSeedRunner(DemoDataSeedService demoDataSeedService) {
        this.demoDataSeedService = demoDataSeedService;
    }

    /**
     * Seeds useful screenshot data when a dev database starts empty.
     *
     * <p>Example: {@code demoDataSeedRunner.run(args)}.</p>
     */
    @Override
    public void run(@NonNull ApplicationArguments args) {
        if (!demoDataSeedService.isDatabaseEmpty()) return;
        demoDataSeedService.resetDemoData();
    }
}
