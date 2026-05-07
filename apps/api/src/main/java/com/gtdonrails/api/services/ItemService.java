package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.time.Duration;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import com.gtdonrails.api.types.BlockEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ContextRepository contextRepository;
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
        ContextRepository contextRepository,
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
        this.contextRepository = contextRepository;
        this.itemMapper = itemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.itemBodyNormalizer = itemBodyNormalizer;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Returns one active item as an API response.
     *
     * <p>Example: {@code itemService.getItem(itemId)}.</p>
     */
    @Transactional(readOnly = true)
    public ItemResponseDto getItem(UUID id) {
        return itemMapper.toResponse(findItem(id));
    }

    /**
     * Creates an item after normalizing request text and resolving contexts.
     *
     * <p>Example: {@code itemService.createItem(request)}.</p>
     */
    @Transactional
    public ItemResponseDto createItem(CreateItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        ItemBody body = itemBodyNormalizer.normalizeBody(request.body());
        rejectCreateBlockEntities(body);
        Duration estimatedTime = request.estimatedTime() == null ? null : request.estimatedTime().toDuration();
        Item item = new Item(title, (String) null, request.energy(), estimatedTime);
        item.setBody(body);
        item.replaceContexts(findContextsOrThrow(request.contextIds()));
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item created", PersistenceChangeType.CREATE_ITEM);
        return response;
    }

    /**
     * Updates an active item and replaces contexts only when context ids are provided.
     *
     * <p>Example: {@code itemService.updateItem(itemId, request)}.</p>
     */
    @Transactional
    public ItemResponseDto updateItem(UUID id, UpdateItemRequestDto request) {
        Item item = findItem(id);
        updateItemFields(id, item, request);

        if (request.contextIds() != null) {
            item.replaceContexts(findContextsOrThrow(request.contextIds()));
        }

        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item updated", PersistenceChangeType.UPDATE_ITEM);
        return response;
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
     * Updates only provided item metadata fields.
     *
     * <p>Example: {@code itemService.patchItem(itemId, request)}.</p>
     */
    @Transactional
    public ItemResponseDto patchItem(UUID id, PatchItemRequestDto request) {
        Item item = findItem(id);
        patchItemFields(item, request);
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item metadata updated", PersistenceChangeType.UPDATE_ITEM);
        return response;
    }

    private void updateItemFields(UUID itemId, Item item, UpdateItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        ItemBody body = itemBodyNormalizer.normalizeBody(request.body());
        validateBlockEntityAssets(itemId, body);

        item.setTitle(title);
        item.setBody(body);
        item.setEnergy(request.energy());
        item.setEstimatedTime(request.estimatedTime() == null ? null : request.estimatedTime().toDuration());
    }

    private void patchItemFields(Item item, PatchItemRequestDto request) {
        if (request.hasTitle()) {
            item.setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
        }
        if (request.hasEnergy()) {
            item.setEnergy(request.energy());
        }
        if (request.hasEstimatedTime()) {
            item.setEstimatedTime(request.estimatedTime() == null ? null : request.estimatedTime().toDuration());
        }
        if (request.hasContextIds()) {
            item.replaceContexts(findContextsOrThrow(request.contextIds()));
        }
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

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private Set<Context> findContextsOrThrow(List<UUID> contextIds) {
        if (contextIds == null || contextIds.isEmpty()) {
            return Set.of();
        }

        Set<UUID> uniqueContextIds = new HashSet<>(contextIds);
        List<Context> contexts = contextRepository.findAllByIdInAndDeletedAtIsNull(uniqueContextIds);

        if (contexts.size() != uniqueContextIds.size()) {
            throw new ContextNotFoundException("context not found");
        }

        return new HashSet<>(contexts);
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }

    private void requestAssetSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> assetSyncService.requestSync(reason));
    }

    private void rejectCreateBlockEntities(ItemBody body) {
        if (body.blockEntities().isEmpty()) {
            return;
        }

        throw new BusinessException("body.blockEntities value is invalid; expected uploaded assets on an existing item");
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

    private ItemAssetResponseDto itemAssetResponse(ItemAsset asset) {
        return new ItemAssetResponseDto(
            asset.getId(),
            asset.getRelativePath(),
            asset.getFileName(),
            asset.getContentType(),
            asset.isImage());
    }
}
