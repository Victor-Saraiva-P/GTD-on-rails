package com.gtdonrails.api.services;

import com.gtdonrails.api.dtos.sync.DataSyncState;
import com.gtdonrails.api.dtos.sync.DataSyncStatusDto;
import com.gtdonrails.api.dtos.sync.FileSyncState;
import com.gtdonrails.api.dtos.sync.FileSyncStatusDto;
import org.springframework.stereotype.Service;

/**
 * Exposes the canonical File Sync contract while retaining Data Sync compatibility.
 *
 * <p>Example: {@code fileSyncService.requestManualSync()}.</p>
 */
@Service
public class FileSyncService {

    private final DataSyncService dataSyncService;

    public FileSyncService(DataSyncService dataSyncService) {
        this.dataSyncService = dataSyncService;
    }

    public void syncOnStartup() throws java.io.IOException {
        dataSyncService.syncOnStartup();
    }

    public void requestSync(String reason) {
        dataSyncService.requestSync(reason);
    }

    public void requestManualSync() {
        dataSyncService.requestManualSync();
    }

    public FileSyncStatusDto status() {
        return toFileStatus(dataSyncService.status());
    }

    private FileSyncStatusDto toFileStatus(DataSyncStatusDto status) {
        return new FileSyncStatusDto(
            toFileState(status.state()),
            status.pending(),
            status.running(),
            status.lastStartedAt(),
            status.lastFinishedAt(),
            status.lastSuccessfulSyncAt(),
            status.lastError());
    }

    private FileSyncState toFileState(DataSyncState state) {
        return FileSyncState.valueOf(state.name());
    }
}
