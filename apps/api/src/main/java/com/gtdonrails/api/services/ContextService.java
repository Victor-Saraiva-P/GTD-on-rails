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

    public ContextService(
        ContextRepository contextRepository,
        NextActionRepository nextActionRepository,
        ContextMapper contextMapper,
        ItemMapper itemMapper,
        ContextNameNormalizer contextNameNormalizer,
        ContextIconAssetService contextIconAssetService
    ) {
        this.contextRepository = contextRepository;
        this.nextActionRepository = nextActionRepository;
        this.contextMapper = contextMapper;
        this.itemMapper = itemMapper;
        this.contextNameNormalizer = contextNameNormalizer;
        this.contextIconAssetService = contextIconAssetService;
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
        return contextMapper.toResponse(contextRepository.save(context));
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
        return contextMapper.toResponse(contextRepository.save(context));
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
    }

    /**
     * Restores a soft-deleted context and schedules File Sync after commit.
     *
     * <p>Example: {@code contextService.restoreContext(contextId)}.</p>
     */
    @Transactional
    public void restoreContext(UUID id) {
        Context context = contextRepository.findById(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
        context.restore();
        contextRepository.save(context);
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }

}
