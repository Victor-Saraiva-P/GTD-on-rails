package com.gtdonrails.api.services;

import static org.mockito.Mockito.inOrder;

import com.gtdonrails.api.repositories.GoogleCredentialRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StagingDataResetServiceTests {

    @Mock
    private DemoDataSeedService demoDataSeedService;

    @Mock
    private GoogleCredentialRepository googleCredentialRepository;

    @Test
    void resetsDemoRowsBeforeRemovingGoogleAuthorization() {
        StagingDataResetService service = new StagingDataResetService(demoDataSeedService, googleCredentialRepository);

        service.reset();

        InOrder order = inOrder(demoDataSeedService, googleCredentialRepository);
        order.verify(demoDataSeedService).resetDemoData();
        order.verify(googleCredentialRepository).deleteAll();
    }
}
