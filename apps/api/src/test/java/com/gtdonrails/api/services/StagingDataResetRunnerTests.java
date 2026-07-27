package com.gtdonrails.api.services;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;

@ExtendWith(MockitoExtension.class)
class StagingDataResetRunnerTests {

    @Mock
    private DatabaseIdentityService databaseIdentityService;

    @Mock
    private FileSyncService fileSyncService;

    @Mock
    private StagingDataResetService stagingDataResetService;

    @InjectMocks
    private StagingDataResetRunner stagingDataResetRunner;

    @Test
    void resetsRowsRemovesAuthorizationAndPublishesInOrder() throws Exception {
        stagingDataResetRunner.run(new DefaultApplicationArguments());

        InOrder order = inOrder(databaseIdentityService, stagingDataResetService, fileSyncService);
        order.verify(databaseIdentityService).require("STAGING");
        order.verify(stagingDataResetService).reset();
        order.verify(fileSyncService).syncNow();
    }

    @Test
    void refusesAnUnexpectedDatabaseBeforeChangingState() {
        doThrow(new IllegalStateException("database identity mismatch"))
            .when(databaseIdentityService).require("STAGING");

        assertThrows(IllegalStateException.class, () -> stagingDataResetRunner.run(new DefaultApplicationArguments()));

        verifyNoInteractions(stagingDataResetService, fileSyncService);
    }
}
