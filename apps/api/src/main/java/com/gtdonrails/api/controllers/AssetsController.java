package com.gtdonrails.api.controllers;

import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.item.CopyLocalItemAssetRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.normalizers.AssetPathNormalizer;
import com.gtdonrails.api.services.AssetStorageService;
import com.gtdonrails.api.services.ContextIconAssetService;
import com.gtdonrails.api.services.ItemAssetService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class AssetsController {

    private final AssetStorageService assetStorageService;
    private final AssetPathNormalizer assetPathNormalizer;
    private final ItemAssetService itemAssetService;
    private final ContextIconAssetService contextIconAssetService;

    public AssetsController(
        AssetStorageService assetStorageService,
        AssetPathNormalizer assetPathNormalizer,
        ItemAssetService itemAssetService,
        ContextIconAssetService contextIconAssetService
    ) {
        this.assetStorageService = assetStorageService;
        this.assetPathNormalizer = assetPathNormalizer;
        this.itemAssetService = itemAssetService;
        this.contextIconAssetService = contextIconAssetService;
    }

    /**
     * Handles context icon replacement uploads as image-only assets.
     *
     * <p>Example: {@code PUT /contexts/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/icon}.</p>
     */
    @PutMapping("/contexts/{id}/icon")
    public ContextResponseDto updateContextIcon(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return contextIconAssetService.updateContextIcon(id, file);
    }

    /**
     * Handles context icon deletion requests by removing icon asset metadata.
     *
     * <p>Example: {@code DELETE /contexts/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/icon}.</p>
     */
    @DeleteMapping("/contexts/{id}/icon")
    public ContextResponseDto deleteContextIcon(@PathVariable UUID id) {
        return contextIconAssetService.deleteContextIcon(id);
    }

    /**
     * Handles item asset upload requests and returns markdown-ready asset metadata.
     *
     * <p>Example: {@code POST /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/assets}.</p>
     */
    @PostMapping("/items/{id}/assets")
    public ItemAssetResponseDto uploadItemAsset(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return itemAssetService.storeItemAsset(id, file);
    }

    /**
     * Handles local item asset copy requests and returns markdown-ready asset metadata.
     *
     * <p>Example: {@code POST /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/assets/local-file}.</p>
     */
    @PostMapping("/items/{id}/assets/local-file")
    public ItemAssetResponseDto copyLocalItemAsset(@PathVariable UUID id, @Valid @RequestBody CopyLocalItemAssetRequestDto request) {
        return itemAssetService.storeLocalItemAsset(id, request);
    }

    /**
     * Serves a stored asset after normalizing the captured path.
     *
     * <p>Example: {@code GET /assets/contexts/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/icon.png}.</p>
     */
    @GetMapping("/assets/{*relativePath}")
    public ResponseEntity<Resource> getAsset(@PathVariable String relativePath) {
        String normalizedRelativePath = assetPathNormalizer.normalizeCapturedPath(relativePath);
        Resource resource = assetStorageService.loadAsResource(normalizedRelativePath);

        return ResponseEntity
            .ok()
            .contentType(assetStorageService.mediaType(normalizedRelativePath))
            .body(resource);
    }

}
