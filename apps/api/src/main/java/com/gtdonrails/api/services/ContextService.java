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
import com.gtdonrails.api.persistence.bootstrap.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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

    public ContextService(
        ContextRepository contextRepository,
        ItemRepository itemRepository,
        ContextMapper contextMapper,
        ItemMapper itemMapper,
        ContextNameNormalizer contextNameNormalizer,
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService,
        PersistenceGitSyncService persistenceGitSyncService
    ) {
        this.contextRepository = contextRepository;
        this.itemRepository = itemRepository;
        this.contextMapper = contextMapper;
        this.itemMapper = itemMapper;
        this.contextNameNormalizer = contextNameNormalizer;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
    }

    @Transactional(readOnly = true)
    public List<ContextResponseDto> listContexts() {
        return contextRepository.findAllByDeletedAtIsNullOrderByNameAsc()
            .stream()
            .map(contextMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public ContextResponseDto getContext(UUID id) {
        return contextMapper.toResponse(findContext(id));
    }

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

    @Transactional
    public ContextResponseDto createContext(CreateContextRequestDto request) {
        String normalizedName = contextNameNormalizer.normalize(request.name());
        Context context = new Context(normalizedName);
        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestPersistenceSyncAfterCommit("context created", PersistenceChangeType.CREATE_CONTEXT);
        return response;
    }

    @Transactional
    public ContextResponseDto updateContext(UUID id, UpdateContextRequestDto request) {
        Context context = findContext(id);
        String normalizedName = contextNameNormalizer.normalize(request.name());

        context.setName(normalizedName);
        ContextResponseDto response = contextMapper.toResponse(contextRepository.save(context));
        requestPersistenceSyncAfterCommit("context updated", PersistenceChangeType.UPDATE_CONTEXT);
        return response;
    }

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
        runAfterCommitOrNow(() -> assetSyncService.requestSync(reason));
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        runAfterCommitOrNow(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }

    private void runAfterCommitOrNow(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
