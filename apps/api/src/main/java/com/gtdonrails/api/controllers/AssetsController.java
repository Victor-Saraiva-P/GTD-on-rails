package com.gtdonrails.api.controllers;

import com.gtdonrails.api.dtos.assets.AssetSyncStatusDto;
import com.gtdonrails.api.normalizers.AssetPathNormalizer;
import com.gtdonrails.api.services.AssetStorageService;
import com.gtdonrails.api.services.AssetSyncService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/assets")
public class AssetsController {

    private final AssetStorageService assetStorageService;
    private final AssetSyncService assetSyncService;
    private final AssetPathNormalizer assetPathNormalizer;

    public AssetsController(
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService,
        AssetPathNormalizer assetPathNormalizer
    ) {
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.assetPathNormalizer = assetPathNormalizer;
    }

    @GetMapping("/sync/status")
    public AssetSyncStatusDto getSyncStatus() {
        return assetSyncService.status();
    }

    @PostMapping("/sync")
    public ResponseEntity<AssetSyncStatusDto> requestSync() {
        assetSyncService.requestManualSync();

        return ResponseEntity
            .status(HttpStatus.ACCEPTED)
            .body(assetSyncService.status());
    }

    @GetMapping("/{*relativePath}")
    public ResponseEntity<Resource> getAsset(@PathVariable String relativePath) {
        String normalizedRelativePath = assetPathNormalizer.normalizeCapturedPath(relativePath);
        Resource resource = assetStorageService.loadAsResource(normalizedRelativePath);

        return ResponseEntity
            .ok()
            .contentType(assetStorageService.mediaType(normalizedRelativePath))
            .body(resource);
    }

}
