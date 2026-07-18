package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Path;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.dtos.sync.DataSyncState;
import com.gtdonrails.api.dtos.sync.DataSyncStatusDto;
import com.gtdonrails.api.dtos.sync.FileSyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileSyncServiceTests {

    @TempDir
    private Path tempDir;

    private FakeDataSyncService dataSyncService;

    @AfterEach
    void tearDown() {
        if (dataSyncService != null) dataSyncService.shutdown();
    }

    @Test
    void forwardsStartupAndRequestsToCompatibilityService() throws IOException {
        dataSyncService = new FakeDataSyncService(tempDir);
        FileSyncService fileSyncService = new FileSyncService(dataSyncService);

        fileSyncService.syncOnStartup();
        fileSyncService.requestSync("item updated");
        fileSyncService.requestManualSync();

        assertEquals(1, dataSyncService.startupCalls);
        assertEquals("item updated", dataSyncService.lastReason);
        assertEquals(1, dataSyncService.manualCalls);
    }

    @Test
    void mapsCompatibilityStatusToCanonicalStatus() {
        dataSyncService = new FakeDataSyncService(tempDir);
        FileSyncService fileSyncService = new FileSyncService(dataSyncService);

        assertEquals(FileSyncState.DISABLED, fileSyncService.status().state());
    }

    private static class FakeDataSyncService extends DataSyncService {

        private int startupCalls;
        private int manualCalls;
        private String lastReason;

        private FakeDataSyncService(Path dataRoot) {
            super(new DataSyncProperties(), new RcloneDataSyncService(new DataSyncProperties()), dataRoot.toString());
        }

        @Override
        public void syncOnStartup() {
            startupCalls++;
        }

        @Override
        public void requestSync(String reason) {
            lastReason = reason;
        }

        @Override
        public void requestManualSync() {
            manualCalls++;
        }

        @Override
        public DataSyncStatusDto status() {
            return new DataSyncStatusDto(
                DataSyncState.DISABLED,
                false,
                false,
                null,
                null,
                null,
                null);
        }
    }
}
