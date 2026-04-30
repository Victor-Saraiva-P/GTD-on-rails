package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ContextService {

    private final ContextRepository contextRepository;
    private final ItemRepository itemRepository;
    private final ContextMapper contextMapper;
    private final ItemMapper itemMapper;
    private final ContextNameNormalizer contextNameNormalizer;
    private final AssetStorageService assetStorageService;
    private final AssetSyncService assetSyncService;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ContextService(
        ContextRepository contextRepository,
        ItemRepository itemRepository,
        ContextMapper contextMapper,
        ItemMapper itemMapper,
        ContextNameNormalizer contextNameNormalizer,
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService, PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor) {
        this.contextRepository = contextRepository;
        this.itemRepository = itemRepository;
        this.contextMapper = contextMapper;
        this.itemMapper = itemMapper;
        this.contextNameNormalizer = contextNameNormalizer;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Lists active contexts ordered for context picker display.
     *
     * <p>Example: {@code contextService.listContexts()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ContextResponseDto> listContexts() {
        return contextRepository.findAllByDeletedAtIsNullOrderByNameAsc()
            .stream()
            .map(contextMapper::toResponse)
            .toList();
    }

    /**
     * Returns one active context as an API response.
     *
     * <p>Example: {@code contextService.getContext(contextId)}.</p>
     */
    @Transactional(readOnly = true)
    public ContextResponseDto getContext(UUID id) {
        return contextMapper.toResponse(findContext(id));
    }

    /**
     * Lists active items assigned to a context, optionally capped for previews.
     *
     * <p>Example: {@code contextService.listContextItems(contextId, 10)}.</p>
     */
    @Transactional(readOnly = true)
    public List<ContextItemResponseDto> listContextItems(UUID id, Integer limit) {
        findContext(id);

        if (limit == null) {
            return itemRepository.findAllByContexts_IdAndDeletedAtIsNullOrderByUpdatedAtDesc(id)
                .stream()
                .map(itemMapper::toContextItemResponse)
                .toList();
        }

        return itemRepository.findAllByContexts_IdAndDeletedAtIsNullOrderByUpdatedAtDesc(
                id,
                PageRequest.of(0, limit)
            )
            .stream()
            .map(itemMapper::toContextItemResponse)
            .toList();
    }

    /**
     * Creates a context after normalizing the requested name.
     *
     * <p>Example: {@code contextService.createContext(request)}.</p>
     */
    @Transactional
    public ContextResponseDto createContext(CreateContextRequestDto request) {
        String normalizedName = contextNameNormalizer.normalize(request.name());
        Context context = new Context(normalizedName);
        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestPersistenceSyncAfterCommit("context created", PersistenceChangeType.CREATE_CONTEXT);
        return response;
    }

    /**
     * Renames an active context after applying context-name normalization.
     *
     * <p>Example: {@code contextService.updateContext(contextId, request)}.</p>
     */
    @Transactional
    public ContextResponseDto updateContext(UUID id, UpdateContextRequestDto request) {
        Context context = findContext(id);
        String normalizedName = contextNameNormalizer.normalize(request.name());

        context.setName(normalizedName);
        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestPersistenceSyncAfterCommit("context updated", PersistenceChangeType.UPDATE_CONTEXT);
        return response;
    }

    /**
     * Soft deletes a context and clears item and asset references before sync.
     *
     * <p>Example: {@code contextService.deleteContext(contextId)}.</p>
     */
    @Transactional
    public void deleteContext(UUID id) {
        Context context = findContext(id);
        new HashSet<>(context.getItems()).forEach(item -> item.removeContext(context));
        assetStorageService.deleteAsset(context.getIconAssetPath());
        context.softDelete();
        contextRepository.save(context);
        requestAssetSyncAfterCommit("context deleted");
        requestPersistenceSyncAfterCommit("context deleted", PersistenceChangeType.DELETE_CONTEXT);
    }

    /**
     * Stores a replacement context icon and removes the previous asset.
     *
     * <p>Example: {@code contextService.updateContextIcon(contextId, file)}.</p>
     */
    @Transactional
    public ContextResponseDto updateContextIcon(UUID id, MultipartFile file) {
        Context context = findContext(id);
        String previousIconAssetPath = context.getIconAssetPath();
        String iconAssetPath = assetStorageService.storeContextIcon(id, file);

        if (previousIconAssetPath != null && !previousIconAssetPath.equals(iconAssetPath)) {
            assetStorageService.deleteAsset(previousIconAssetPath);
        }

        context.setIconAssetPath(iconAssetPath);
        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestAssetSyncAfterCommit("context icon updated");
        requestPersistenceSyncAfterCommit("context icon updated", PersistenceChangeType.UPDATE_CONTEXT_ICON);
        return response;
    }

    /**
     * Removes the current context icon and schedules asset persistence sync.
     *
     * <p>Example: {@code contextService.deleteContextIcon(contextId)}.</p>
     */
    @Transactional
    public ContextResponseDto deleteContextIcon(UUID id) {
        Context context = findContext(id);
        assetStorageService.deleteAsset(context.getIconAssetPath());
        context.setIconAssetPath(null);

        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestAssetSyncAfterCommit("context icon deleted");
        requestPersistenceSyncAfterCommit("context icon deleted", PersistenceChangeType.DELETE_CONTEXT_ICON);
        return response;
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }

    private void requestAssetSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> assetSyncService.requestSync(reason));
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }
}
