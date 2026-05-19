package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContextService {

    private final ContextRepository contextRepository;
    private final NextActionRepository nextActionRepository;
    private final ContextMapper contextMapper;
    private final ItemMapper itemMapper;
    private final ContextNameNormalizer contextNameNormalizer;
    private final ContextIconAssetService contextIconAssetService;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ContextService(
        ContextRepository contextRepository,
        NextActionRepository nextActionRepository,
        ContextMapper contextMapper,
        ItemMapper itemMapper,
        ContextNameNormalizer contextNameNormalizer,
        ContextIconAssetService contextIconAssetService,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.contextRepository = contextRepository;
        this.nextActionRepository = nextActionRepository;
        this.contextMapper = contextMapper;
        this.itemMapper = itemMapper;
        this.contextNameNormalizer = contextNameNormalizer;
        this.contextIconAssetService = contextIconAssetService;
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
            return nextActionRepository.findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(id)
                .stream()
                .map(NextAction::getItem)
                .map(itemMapper::toContextItemResponse)
                .toList();
        }

        return nextActionRepository.findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(
                id,
                PageRequest.of(0, limit)
            )
            .stream()
            .map(NextAction::getItem)
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
        new HashSet<>(context.getNextActions()).forEach(nextAction -> nextAction.removeContext(context));
        contextIconAssetService.deleteContextIconAsset(context);
        context.softDelete();
        contextRepository.save(context);
        requestPersistenceSyncAfterCommit("context deleted", PersistenceChangeType.DELETE_CONTEXT);
    }

    /**
     * Restores a soft-deleted context and schedules persistence sync after commit.
     *
     * <p>Example: {@code contextService.restoreContext(contextId)}.</p>
     */
    @Transactional
    public void restoreContext(UUID id) {
        Context context = contextRepository.findById(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
        context.restore();
        contextRepository.save(context);
        requestPersistenceSyncAfterCommit("context restored", PersistenceChangeType.UPDATE_CONTEXT);
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }
}
