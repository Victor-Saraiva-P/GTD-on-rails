package com.gtdonrails.api.services;

import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ContextIconAssetService {

    private final ContextRepository contextRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final AssetStorageService assetStorageService;
    private final AssetSyncService assetSyncService;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final ContextMapper contextMapper;

    public ContextIconAssetService(
        ContextRepository contextRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        AssetStorageService assetStorageService,
        AssetSyncService assetSyncService,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor,
        ContextMapper contextMapper
    ) {
        this.contextRepository = contextRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.assetStorageService = assetStorageService;
        this.assetSyncService = assetSyncService;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.contextMapper = contextMapper;
    }

    /**
     * Stores a replacement context icon asset and returns the updated context.
     *
     * <p>Example: {@code service.updateContextIcon(contextId, file)}.</p>
     */
    @Transactional
    public ContextResponseDto updateContextIcon(UUID id, MultipartFile file) {
        Context context = findContext(id);
        deleteExistingIcon(context);
        ContextIconAsset iconAsset = newContextIconAsset(context, file);
        assetStorageService.storeImageAsset(iconAsset.relativePath(), file);
        iconAsset = contextIconAssetRepository.save(iconAsset);
        context.setIconAsset(iconAsset);
        requestAssetSyncAfterCommit("context icon updated");
        requestPersistenceSyncAfterCommit("context icon updated", PersistenceChangeType.UPDATE_CONTEXT_ICON);
        return contextMapper.toResponse(context);
    }

    /**
     * Removes the current context icon asset and returns the updated context.
     *
     * <p>Example: {@code service.deleteContextIcon(contextId)}.</p>
     */
    @Transactional
    public ContextResponseDto deleteContextIcon(UUID id) {
        Context context = findContext(id);
        deleteExistingIcon(context);
        requestAssetSyncAfterCommit("context icon deleted");
        requestPersistenceSyncAfterCommit("context icon deleted", PersistenceChangeType.DELETE_CONTEXT_ICON);
        return contextMapper.toResponse(context);
    }

    /**
     * Removes a context icon during context deletion without extra persistence sync.
     *
     * <p>Example: {@code service.deleteContextIconAsset(context)}.</p>
     */
    public void deleteContextIconAsset(Context context) {
        deleteExistingIcon(context);
        requestAssetSyncAfterCommit("context deleted");
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }

    private void deleteExistingIcon(Context context) {
        contextIconAssetRepository.findByContextId(context.getId()).ifPresent(iconAsset -> {
            context.setIconAsset(null);
            contextIconAssetRepository.delete(iconAsset);
            contextIconAssetRepository.flush();
            assetStorageService.deleteAsset(iconAsset.relativePath());
        });
    }

    private ContextIconAsset newContextIconAsset(Context context, MultipartFile file) {
        String fileName = assetStorageService.imageAssetFileName(file);
        return new ContextIconAsset(
            context,
            fileName,
            file.getOriginalFilename() == null ? fileName : file.getOriginalFilename(),
            contentType(file.getContentType(), fileName),
            file.getSize());
    }

    private String contentType(String requestContentType, String fileName) {
        if (StringUtils.hasText(requestContentType)) return requestContentType;
        return assetStorageService.mediaType(fileName).toString();
    }

    private void requestAssetSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> assetSyncService.requestSync(reason));
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }
}
