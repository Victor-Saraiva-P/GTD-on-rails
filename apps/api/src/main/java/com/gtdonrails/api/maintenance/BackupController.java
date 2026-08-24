package com.gtdonrails.api.maintenance;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile({"prod", "staging"})
@RequestMapping("/maintenance/backups")
public class BackupController {

    private final PostgresBackupService backupService;

    public BackupController(PostgresBackupService backupService) {
        this.backupService = backupService;
    }

    /** Creates a complete manual PostgreSQL archive and queues File Sync after it closes.
     *
     * <p>Example: {@code POST /maintenance/backups}.</p>
     */
    @PostMapping
    public ResponseEntity<BackupResponse> createBackup() {
        BackupResult result = backupService.createManualBackup();
        return ResponseEntity.status(HttpStatus.CREATED).body(new BackupResponse(result.fileName(), result.size()));
    }

    public record BackupResponse(String fileName, long size) {
    }
}
