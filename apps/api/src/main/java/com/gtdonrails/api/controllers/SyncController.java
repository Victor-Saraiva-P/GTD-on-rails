package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.assets.AssetSyncStatusDto;
import com.gtdonrails.api.dtos.sync.SyncStatusDto;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.services.AssetSyncService;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

    private final AssetSyncService assetSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final PersistenceGitSyncService persistenceGitSyncService;

    public SyncController(
        AssetSyncService assetSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        PersistenceGitSyncService persistenceGitSyncService
    ) {
        this.assetSyncService = assetSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.persistenceGitSyncService = persistenceGitSyncService;
    }

    /**
     * Handles sync status requests for persistence and assets.
     *
     * <p>Example: {@code GET /sync/status}.</p>
     */
    @GetMapping("/sync/status")
    public SyncStatusDto getStatus() {
        return new SyncStatusDto(
            assetSyncService.status(),
            googleCalendarEventQueueService.status(),
            persistenceGitSyncService.status());
    }

    /**
     * Handles asset sync status requests for the rclone side of system sync.
     *
     * <p>Example: {@code GET /assets/sync/status}.</p>
     */
    @GetMapping("/assets/sync/status")
    public AssetSyncStatusDto getAssetSyncStatus() {
        return assetSyncService.status();
    }

    /**
     * Handles manual asset sync requests and reports the queued status.
     *
     * <p>Example: {@code POST /assets/sync}.</p>
     */
    @PostMapping("/assets/sync")
    public ResponseEntity<AssetSyncStatusDto> requestAssetSync() {
        assetSyncService.requestManualSync();

        return ResponseEntity
            .status(HttpStatus.ACCEPTED)
            .body(assetSyncService.status());
    }
}
