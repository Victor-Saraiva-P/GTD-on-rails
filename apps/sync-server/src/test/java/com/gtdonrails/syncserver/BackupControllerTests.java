package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

class BackupControllerTests {

    @Test
    void environmentIdentityDistinguishesStagingFromProduction() {
        SnapshotBackupService backups = mock(SnapshotBackupService.class);
        SnapshotRestoreService restores = mock(SnapshotRestoreService.class);

        BackupController staging = new BackupController(backups, restores, "staging");
        BackupController production = new BackupController(backups, restores, "production");

        assertEquals("staging", staging.environment().environment());
        assertEquals("production", production.environment().environment());
    }
}
