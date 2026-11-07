package com.gtdonrails.syncserver;

import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/backups")
public class BackupController {

    private final SnapshotBackupService backups;
    private final SnapshotRestoreService restores;
    private final String environment;

    public BackupController(
        SnapshotBackupService backups,
        SnapshotRestoreService restores,
        @Value("${gtd.sync-server.environment:production}") String environment
    ) {
        this.backups = backups;
        this.restores = restores;
        this.environment = environment;
    }

    @GetMapping("/environment")
    public EnvironmentResponse environment() {
        return new EnvironmentResponse(environment);
    }

    public record EnvironmentResponse(String environment) {
    }

    @PostMapping
    public BackupResponse create() {
        Path snapshot = backups.createSnapshot();
        return new BackupResponse(snapshot.getFileName().toString());
    }

    public record BackupResponse(String fileName) {
    }
    @PostMapping("/restore")
    public RestoreResponse restore(@RequestBody RestoreRequest request) {
        SnapshotRestoreService.RestoreResult result = restores.restore(request.fileName());
        return new RestoreResponse(result.datasetEpoch(), result.cursor());
    }

    public record RestoreRequest(String fileName) {
    }

    public record RestoreResponse(String datasetEpoch, long cursor) {
    }

}
