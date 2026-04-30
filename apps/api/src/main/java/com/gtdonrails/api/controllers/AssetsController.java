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

    /**
     * Handles asset sync status requests.
     *
     * <p>Example: {@code GET /assets/sync/status}.</p>
     */
    @GetMapping("/sync/status")
    public AssetSyncStatusDto getSyncStatus() {
        return assetSyncService.status();
    }

    /**
     * Handles manual asset sync requests and reports the queued status.
     *
     * <p>Example: {@code POST /assets/sync}.</p>
     */
    @PostMapping("/sync")
    public ResponseEntity<AssetSyncStatusDto> requestSync() {
        assetSyncService.requestManualSync();

        return ResponseEntity
            .status(HttpStatus.ACCEPTED)
            .body(assetSyncService.status());
    }

    /**
     * Serves a stored asset after normalizing the captured path.
     *
     * <p>Example: {@code GET /assets/contexts/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/icon.png}.</p>
     */
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
