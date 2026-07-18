package com.gtdonrails.api.services;

import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.gtdonrails.api.dtos.item.CopyLocalItemAssetRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.ItemBody;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ItemAssetService {

    private final ItemRepository itemRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final AssetStorageService assetStorageService;
    private final FileSyncService fileSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ItemAssetService(
        ItemRepository itemRepository,
        ItemAssetRepository itemAssetRepository,
        AssetStorageService assetStorageService,
        FileSyncService fileSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.assetStorageService = assetStorageService;
        this.fileSyncService = fileSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Stores an uploaded asset for an active item and returns markdown-ready metadata.
     *
     * <p>Example: {@code itemAssetService.storeItemAsset(itemId, file)}.</p>
     */
    @Transactional
    public ItemAssetResponseDto storeItemAsset(UUID id, MultipartFile file) {
        Item item = findItem(id);
        ItemAsset itemAsset = newItemAsset(item, file);
        assetStorageService.storeItemAsset(itemAsset.relativePath(), file);
        itemAssetRepository.save(itemAsset);
        fileSyncService.requestSyncAfterCommit(afterCommitExecutor, "item asset uploaded");
        return itemAssetResponse(itemAsset);
    }

    /**
     * Copies a local file for an active item and returns markdown-ready metadata.
     *
     * <p>Example: {@code itemAssetService.storeLocalItemAsset(itemId, request)}.</p>
     */
    @Transactional
    public ItemAssetResponseDto storeLocalItemAsset(UUID id, CopyLocalItemAssetRequestDto request) {
        Item item = findItem(id);
        Path sourcePath = Path.of(request.sourcePath()).toAbsolutePath().normalize();
        ItemAsset itemAsset = newLocalItemAsset(item, sourcePath);
        assetStorageService.copyLocalItemAsset(itemAsset.relativePath(), sourcePath);
        itemAssetRepository.save(itemAsset);
        fileSyncService.requestSyncAfterCommit(afterCommitExecutor, "local item asset copied");
        return itemAssetResponse(itemAsset);
    }

    /**
     * Reconciles persisted item assets against the saved body references.
     *
     * <p>Example: {@code itemAssetService.reconcileBodyAssetReferences(itemId, body)}.</p>
     */
    public void reconcileBodyAssetReferences(UUID itemId, ItemBody body) {
        Set<UUID> referencedAssetIds = referencedAssetIds(body);
        referencedAssetIds.forEach(assetId -> restoreReferencedAsset(itemId, assetId));
        softDeleteUnreferencedAssets(itemId, referencedAssetIds);
    }

    /**
     * Soft deletes every active asset owned by an item.
     *
     * <p>Example: {@code itemAssetService.softDeleteActiveItemAssets(itemId)}.</p>
     */
    public void softDeleteActiveItemAssets(UUID itemId) {
        itemAssetRepository.findAllByItemIdAndDeletedAtIsNull(itemId)
            .forEach(this::softDeleteItemAsset);
    }

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private Set<UUID> referencedAssetIds(ItemBody body) {
        return body.blockEntities().stream()
            .map(BlockEntity::assetId)
            .map(this::parseAssetId)
            .collect(Collectors.toSet());
    }

    private void restoreReferencedAsset(UUID itemId, UUID assetId) {
        ItemAsset asset = findOwnedItemAsset(itemId, assetId);
        if (!asset.isDeleted()) return;
        asset.restore();
        itemAssetRepository.save(asset);
    }

    private ItemAsset findOwnedItemAsset(UUID itemId, UUID assetId) {
        return itemAssetRepository.findByIdAndItemId(assetId, itemId)
            .orElseThrow(() -> new BusinessException(
                "body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'"));
    }

    private void softDeleteUnreferencedAssets(UUID itemId, Set<UUID> referencedAssetIds) {
        itemAssetRepository.findAllByItemIdAndDeletedAtIsNull(itemId).stream()
            .filter(asset -> !referencedAssetIds.contains(asset.getId()))
            .forEach(this::softDeleteItemAsset);
    }

    private void softDeleteItemAsset(ItemAsset asset) {
        asset.softDelete();
        itemAssetRepository.save(asset);
    }

    private UUID parseAssetId(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            throw new BusinessException(
                "body.blockEntities.assetId value '" + value + "' is invalid; expected persisted asset UUID");
        }
    }

    private ItemAsset newItemAsset(Item item, MultipartFile file) {
        String fileName = assetStorageService.itemAssetFileName(file);
        return new ItemAsset(
            item,
            fileName,
            file.getOriginalFilename() == null ? fileName : file.getOriginalFilename(),
            contentType(file.getContentType(), fileName),
            file.getSize());
    }

    private ItemAsset newLocalItemAsset(Item item, Path sourcePath) {
        String fileName = assetStorageService.itemAssetFileName(sourcePath.getFileName().toString());
        return new ItemAsset(
            item,
            fileName,
            sourcePath.getFileName().toString(),
            assetStorageService.mediaType(fileName).toString(),
            sourcePath.toFile().length());
    }

    private String contentType(String requestContentType, String fileName) {
        if (StringUtils.hasText(requestContentType)) return requestContentType;
        return assetStorageService.mediaType(fileName).toString();
    }

    private ItemAssetResponseDto itemAssetResponse(ItemAsset asset) {
        String relativePath = asset.relativePath();
        return new ItemAssetResponseDto(
            asset.getId(),
            relativePath,
            assetStorageService.publicUrl(relativePath),
            asset.getFileName(),
            asset.getContentType(),
            asset.isImage());
    }

}
