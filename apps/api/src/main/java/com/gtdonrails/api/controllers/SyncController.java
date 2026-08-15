package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.sync.FileSyncStatusDto;
import com.gtdonrails.api.dtos.sync.SyncStatusDto;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

    private final FileSyncService fileSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;

    public SyncController(
        FileSyncService fileSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService
    ) {
        this.fileSyncService = fileSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
    }

    /**
     * Handles sync status requests for file sync and Google Calendar.
     *
     * <p>Example: {@code GET /sync/status}.</p>
     */
    @GetMapping("/sync/status")
    public SyncStatusDto getStatus() {
        return new SyncStatusDto(
            fileSyncService.status(),
            googleCalendarEventQueueService.status());
    }

    /**
     * Handles canonical manual File Sync requests.
     *
     * <p>Example: {@code POST /sync/files}.</p>
     */
    @PostMapping("/sync/files")
    public ResponseEntity<FileSyncStatusDto> requestFileSync() {
        fileSyncService.requestManualSync();

        return ResponseEntity
            .status(HttpStatus.ACCEPTED)
            .body(fileSyncService.status());
    }
}
