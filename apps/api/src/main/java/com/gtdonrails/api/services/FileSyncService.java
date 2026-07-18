package com.gtdonrails.api.services;

import java.io.IOException;

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

    /**
     * Runs blocking File Sync before the application opens its database.
     *
     * <p>Example: {@code fileSyncService.syncOnStartup()}.</p>
     */
    public void syncOnStartup() throws IOException {
        dataSyncService.syncOnStartup();
    }

    /**
     * Queues File Sync work with an observability reason.
     *
     * <p>Example: {@code fileSyncService.requestSync("item updated")}.</p>
     */
    public void requestSync(String reason) {
        dataSyncService.requestSync(reason);
    }

    /**
     * Queues a user-requested File Sync.
     *
     * <p>Example: {@code fileSyncService.requestManualSync()}.</p>
     */
    public void requestManualSync() {
        dataSyncService.requestManualSync();
    }

    /**
     * Returns the current canonical File Sync status.
     *
     * <p>Example: {@code fileSyncService.status()}.</p>
     */
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
