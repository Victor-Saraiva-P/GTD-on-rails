package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.sync.DataSyncStatusDto;
import com.gtdonrails.api.dtos.sync.SyncStatusDto;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

    private final DataSyncService dataSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;

    public SyncController(
        DataSyncService dataSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService
    ) {
        this.dataSyncService = dataSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
    }

    /**
     * Handles sync status requests for data and Google Calendar.
     *
     * <p>Example: {@code GET /sync/status}.</p>
     */
    @GetMapping("/sync/status")
    public SyncStatusDto getStatus() {
        return new SyncStatusDto(
            dataSyncService.status(),
            googleCalendarEventQueueService.status());
    }

    /**
     * Handles manual data sync requests and reports the queued status.
     *
     * <p>Example: {@code POST /sync/data}.</p>
     */
    @PostMapping("/sync/data")
    public ResponseEntity<DataSyncStatusDto> requestDataSync() {
        dataSyncService.requestManualSync();

        return ResponseEntity
            .status(HttpStatus.ACCEPTED)
            .body(dataSyncService.status());
    }
}
