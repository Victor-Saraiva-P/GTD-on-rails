package com.gtdonrails.api.services;

import com.gtdonrails.api.repositories.GoogleCredentialRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("staging-reset")
public class StagingDataResetService {

    private final DemoDataSeedService demoDataSeedService;
    private final GoogleCredentialRepository googleCredentialRepository;

    public StagingDataResetService(
        DemoDataSeedService demoDataSeedService,
        GoogleCredentialRepository googleCredentialRepository
    ) {
        this.demoDataSeedService = demoDataSeedService;
        this.googleCredentialRepository = googleCredentialRepository;
    }

    /**
     * Recreates staging rows and removes database-backed Google authorization atomically.
     *
     * <p>Example: {@code stagingDataResetService.reset()}.</p>
     */
    @Transactional
    public void reset() {
        demoDataSeedService.resetDemoData();
        googleCredentialRepository.deleteAll();
    }
}
