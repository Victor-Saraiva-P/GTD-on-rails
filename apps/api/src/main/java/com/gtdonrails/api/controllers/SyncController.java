package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.sync.SyncStatusDto;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.services.AssetSyncService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sync")
public class SyncController {

    private final AssetSyncService assetSyncService;
    private final PersistenceGitSyncService persistenceGitSyncService;

    public SyncController(
        AssetSyncService assetSyncService,
        PersistenceGitSyncService persistenceGitSyncService
    ) {
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
    }

    @GetMapping("/status")
    public SyncStatusDto getStatus() {
        return new SyncStatusDto(assetSyncService.status(), persistenceGitSyncService.status());
    }
}
