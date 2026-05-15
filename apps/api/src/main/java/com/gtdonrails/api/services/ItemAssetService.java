package com.gtdonrails.api.services;

import java.nio.file.Path;
import java.util.UUID;

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
import org.springframework.web.multipart.MultipartFile;

@Service
public class ItemAssetService {

    private final ItemRepository itemRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final AssetStorageService assetStorageService;
    private final AssetSyncService assetSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ItemAssetService(
        ItemRepository itemRepository,
        ItemAssetRepository itemAssetRepository,
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
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
        String relativePath = assetStorageService.storeItemAsset(id, file);
        ItemAsset itemAsset = saveItemAsset(item, file, relativePath);
        requestAssetSyncAfterCommit("item asset uploaded");
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
        String relativePath = assetStorageService.copyLocalItemAsset(id, sourcePath);
        ItemAsset itemAsset = saveLocalItemAsset(item, sourcePath, relativePath);
        requestAssetSyncAfterCommit("local item asset copied");
        return itemAssetResponse(itemAsset);
    }

    /**
     * Validates that every block entity references an asset owned by the item.
     *
     * <p>Example: {@code itemAssetService.validateBodyAssetOwnership(itemId, body)}.</p>
     */
    public void validateBodyAssetOwnership(UUID itemId, ItemBody body) {
        body.blockEntities().forEach(entity -> validateBlockEntityAsset(itemId, entity));
    }

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private void validateBlockEntityAsset(UUID itemId, BlockEntity entity) {
        UUID assetId = parseAssetId(entity.assetId());
        if (itemAssetRepository.existsByIdAndItemId(assetId, itemId)) return;

        throw new BusinessException(
            "body.blockEntities.assetId value '" + entity.assetId() + "' is invalid; expected asset owned by item '" + itemId + "'");
    }

    private UUID parseAssetId(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            throw new BusinessException(
                "body.blockEntities.assetId value '" + value + "' is invalid; expected persisted asset UUID");
        }
    }

    private ItemAsset saveItemAsset(Item item, MultipartFile file, String relativePath) {
        ItemAsset asset = new ItemAsset(
            item,
            assetStorageService.fileName(relativePath),
            file.getOriginalFilename() == null ? assetStorageService.fileName(relativePath) : file.getOriginalFilename(),
            assetStorageService.mediaType(relativePath).toString(),
            file.getSize(),
            relativePath,
            assetStorageService.publicUrl(relativePath),
            assetStorageService.isImage(relativePath));
        return itemAssetRepository.save(asset);
    }

    private ItemAsset saveLocalItemAsset(Item item, Path sourcePath, String relativePath) {
        ItemAsset asset = new ItemAsset(
            item,
            assetStorageService.fileName(relativePath),
            sourcePath.getFileName().toString(),
            assetStorageService.mediaType(relativePath).toString(),
            sourcePath.toFile().length(),
            relativePath,
            assetStorageService.publicUrl(relativePath),
            assetStorageService.isImage(relativePath));
        return itemAssetRepository.save(asset);
    }

    private ItemAssetResponseDto itemAssetResponse(ItemAsset asset) {
        return new ItemAssetResponseDto(
            asset.getId(),
            asset.getRelativePath(),
            asset.getUrl(),
            asset.getFileName(),
            asset.getContentType(),
            asset.isImage());
    }

    private void requestAssetSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> assetSyncService.requestSync(reason));
    }
}
