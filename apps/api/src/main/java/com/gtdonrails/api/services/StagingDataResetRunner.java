package com.gtdonrails.api.services;

import java.io.IOException;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("staging-reset")
public class StagingDataResetRunner implements ApplicationRunner {

    private final DatabaseIdentityService databaseIdentityService;
    private final FileSyncService fileSyncService;
    private final StagingDataResetService stagingDataResetService;

    public StagingDataResetRunner(
        DatabaseIdentityService databaseIdentityService,
        FileSyncService fileSyncService,
        StagingDataResetService stagingDataResetService
    ) {
        this.databaseIdentityService = databaseIdentityService;
        this.fileSyncService = fileSyncService;
        this.stagingDataResetService = stagingDataResetService;
    }

    /**
     * Replaces staging data, removes stored Google authorization, and publishes it.
     *
     * <p>Example: {@code stagingDataResetRunner.run(args)}.</p>
     */
    @Override
    public void run(ApplicationArguments args) throws IOException {
        databaseIdentityService.require("STAGING");
        stagingDataResetService.reset();
        fileSyncService.syncNow();
    }
}
