package com.gtdonrails.api.services;

import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
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
    private final DataSyncService dataSyncService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final ContextMapper contextMapper;

    public ContextIconAssetService(
        ContextRepository contextRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        AssetStorageService assetStorageService,
        DataSyncService dataSyncService,
        AfterCommitExecutor afterCommitExecutor,
        ContextMapper contextMapper
    ) {
        this.contextRepository = contextRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.assetStorageService = assetStorageService;
        this.dataSyncService = dataSyncService;
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
        contextIconAssetRepository.save(iconAsset);
        requestDataSyncAfterCommit("context icon updated");
        requestDataSyncAfterCommit("context icon updated");
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
        requestDataSyncAfterCommit("context icon deleted");
        requestDataSyncAfterCommit("context icon deleted");
        return contextMapper.toResponse(context);
    }

    /**
     * Removes a context icon during context deletion without extra data sync.
     *
     * <p>Example: {@code service.deleteContextIconAsset(context)}.</p>
     */
    public void deleteContextIconAsset(Context context) {
        deleteExistingIcon(context);
        requestDataSyncAfterCommit("context deleted");
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

    private void requestDataSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> dataSyncService.requestSync(reason));
    }
}
