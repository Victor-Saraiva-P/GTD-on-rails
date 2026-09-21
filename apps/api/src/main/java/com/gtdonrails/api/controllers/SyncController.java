package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.sync.FileSyncStatusDto;
import com.gtdonrails.api.dtos.sync.SyncStatusDto;
import com.gtdonrails.api.services.DatabaseSyncService;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import com.gtdonrails.api.sync.LocalSyncStateStore;
import com.gtdonrails.api.sync.SyncConflictChoice;
import com.gtdonrails.api.sync.SyncConflictService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

    private final FileSyncService fileSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final DatabaseSyncService databaseSyncService;
    private final SyncConflictService conflictService;

    public SyncController(
        FileSyncService fileSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        DatabaseSyncService databaseSyncService,
        SyncConflictService conflictService
    ) {
        this.fileSyncService = fileSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.databaseSyncService = databaseSyncService;
        this.conflictService = conflictService;
    }

    /**
     * Handles sync status requests for file sync, Google Calendar, and database sync.
     *
     * <p>Example: {@code GET /sync/status}.</p>
     */
    @GetMapping("/sync/status")
    public SyncStatusDto getStatus() {
        return new SyncStatusDto(
            fileSyncService.status(),
            googleCalendarEventQueueService.status(),
            databaseSyncService.status());
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
    @GetMapping("/sync/conflicts")
    public java.util.List<LocalSyncStateStore.SyncConflictRecord> conflicts() {
        return conflictService.pending();
    }


    @GetMapping("/sync/conflicts/{id}")
    public com.gtdonrails.api.sync.SyncConflictDetail conflict(@PathVariable long id) {
        return conflictService.detail(id);
    }

    @PostMapping("/sync/conflicts/{id}/resolve")
    public ResponseEntity<Void> resolveConflict(
        @PathVariable long id,
        @RequestBody ResolveConflictRequest request
    ) {
        conflictService.resolve(id, request.choice(), request.mergedContent());
        databaseSyncService.notifyNewEvents();
        fileSyncService.requestSync("conflict resolved");
        return ResponseEntity.noContent().build();
    }

    public record ResolveConflictRequest(
        SyncConflictChoice choice,
        String mergedContent
    ) {
    }

    @PostMapping("/sync/rebootstrap")
    public ResponseEntity<com.gtdonrails.api.sync.SyncServerRebootstrapService.RebootstrapResult> rebootstrap() {
        var result = databaseSyncService.rebootstrap();
        fileSyncService.resumeAfterRebootstrap();
        return ResponseEntity.ok(result);
    }

}
