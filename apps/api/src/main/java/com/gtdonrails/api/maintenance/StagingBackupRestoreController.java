package com.gtdonrails.api.maintenance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("staging")
@RequestMapping("/maintenance/backups")
public class StagingBackupRestoreController {

    private final StagingBackupRestoreService restoreService;

    public StagingBackupRestoreController(StagingBackupRestoreService restoreService) {
        this.restoreService = restoreService;
    }

    /** Restores and validates a named archive in the isolated staging runtime.
     *
     * <p>Example: {@code POST /maintenance/backups/restore}.</p>
     */
    @PostMapping("/restore")
    public RestoreResult restore(@Valid @RequestBody RestoreRequest request) {
        return restoreService.restore(request.archiveName());
    }

    public record RestoreRequest(@NotBlank String archiveName) {
    }
}
