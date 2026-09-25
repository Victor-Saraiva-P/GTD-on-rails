package com.gtdonrails.api.services;

import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.sync.SyncFileOutboxStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ContextIconAssetService {

    private final ContextRepository contextRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final AssetStorageService assetStorageService;
    private final FileSyncService fileSyncService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final ContextMapper contextMapper;
    private final SyncFileOutboxStore fileOutbox;

    @Autowired
    public ContextIconAssetService(
        ContextRepository contextRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        AssetStorageService assetStorageService,
        FileSyncService fileSyncService,
        AfterCommitExecutor afterCommitExecutor,
        ContextMapper contextMapper,
        SyncFileOutboxStore fileOutbox
    ) {
        this.contextRepository = contextRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.assetStorageService = assetStorageService;
        this.fileSyncService = fileSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.contextMapper = contextMapper;
        this.fileOutbox = fileOutbox;
    }

    public ContextIconAssetService(
        ContextRepository contextRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        AssetStorageService assetStorageService,
        FileSyncService fileSyncService,
        AfterCommitExecutor afterCommitExecutor,
        ContextMapper contextMapper
    ) {
        this(contextRepository, contextIconAssetRepository, assetStorageService, fileSyncService, afterCommitExecutor, contextMapper, null);
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
        contextIconAssetRepository.save(iconAsset);
        context.getIconAssets().add(iconAsset);
        enqueueIconSync(iconAsset);
        fileSyncService.requestSyncAfterCommit(afterCommitExecutor);
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
        fileSyncService.requestSyncAfterCommit(afterCommitExecutor);
        return contextMapper.toResponse(context);
    }

    /**
     * Removes a context icon during context deletion without extra File Sync.
     *
     * <p>Example: {@code service.deleteContextIconAsset(context)}.</p>
     */
    public void deleteContextIconAsset(Context context) {
        deleteExistingIcon(context);
        fileSyncService.requestSyncAfterCommit(afterCommitExecutor);
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }

    private void deleteExistingIcon(Context context) {
        contextIconAssetRepository.findByContextIdAndDeletedAtIsNull(context.getId()).ifPresent(iconAsset -> {
            iconAsset.softDelete();
            contextIconAssetRepository.save(iconAsset);
            contextIconAssetRepository.flush();
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

    private void enqueueIconSync(ContextIconAsset asset) {
        if (fileOutbox == null) return;
        fileOutbox.enqueueUpsert(
            "context_icon_file",
            asset.getId().toString(),
            asset.relativePath(),
            asset.getContentType()
        );
    }

}
