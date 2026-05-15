package com.gtdonrails.api.services;

import java.nio.file.Path;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CopyLocalItemAssetRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ItemMapper itemMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final ItemBodyNormalizer itemBodyNormalizer;
    private final AssetStorageService assetStorageService;
    private final AssetSyncService assetSyncService;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ItemService(
        ItemRepository itemRepository,
        ItemAssetRepository itemAssetRepository,
        ItemMapper itemMapper,
        ItemTextNormalizer itemTextNormalizer,
        ItemBodyNormalizer itemBodyNormalizer,
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.itemMapper = itemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.itemBodyNormalizer = itemBodyNormalizer;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Updates only body metadata for an active item.
     *
     * <p>Example: {@code itemService.patchItemBody(itemId, request)}.</p>
     */
    @Transactional
    public ItemResponseDto patchItemBody(UUID id, PatchItemBodyRequestDto request) {
        Item item = findItem(id);
        ItemBody body = itemBodyNormalizer.normalizeBody(request.body());
        validateBlockEntityAssets(id, body);
        item.setBody(body);
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item body updated", PersistenceChangeType.UPDATE_ITEM);
        return response;
    }

    /**
     * Updates only the shared item title.
     *
     * <p>Example: {@code itemService.updateItemTitle(itemId, request)}.</p>
     */
    @Transactional
    public ItemResponseDto updateItemTitle(UUID id, UpdateItemTitleRequestDto request) {
        Item item = findItem(id);
        item.setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item title updated", PersistenceChangeType.UPDATE_ITEM);
        return response;
    }

    /**
     * Soft deletes an active item and schedules persistence sync after commit.
     *
     * <p>Example: {@code itemService.deleteItem(itemId)}.</p>
     */
    @Transactional
    public void deleteItem(UUID id) {
        Item item = findItem(id);
        item.softDelete();
        itemRepository.save(item);
        requestPersistenceSyncAfterCommit("item deleted", PersistenceChangeType.DELETE_ITEM);
    }

    /**
     * Restores a soft-deleted item and schedules persistence sync after commit.
     *
     * <p>Example: {@code itemService.restoreItem(itemId)}.</p>
     */
    @Transactional
    public void restoreItem(UUID id) {
        Item item = itemRepository.findById(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
        item.restore();
        itemRepository.save(item);
        requestPersistenceSyncAfterCommit("item restored", PersistenceChangeType.UPDATE_ITEM);
    }

    /**
     * Stores an asset for an active item and returns its markdown-ready URL.
     *
     * <p>Example: {@code itemService.storeItemAsset(itemId, file)}.</p>
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
     * Copies a local asset for an active item and returns its markdown-ready URL.
     *
     * <p>Example: {@code itemService.storeLocalItemAsset(itemId, request)}.</p>
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

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }

    private void requestAssetSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> assetSyncService.requestSync(reason));
    }

    private void validateBlockEntityAssets(UUID itemId, ItemBody body) {
        body.blockEntities().forEach(entity -> validateBlockEntityAsset(itemId, entity));
    }

    private void validateBlockEntityAsset(UUID itemId, BlockEntity entity) {
        UUID assetId = parseAssetId(entity.assetId());
        if (itemAssetRepository.existsByIdAndItemId(assetId, itemId)) {
            return;
        }

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
}
