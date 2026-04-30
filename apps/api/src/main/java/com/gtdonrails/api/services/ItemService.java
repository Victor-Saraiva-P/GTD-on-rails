package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.time.Duration;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ContextRepository contextRepository;
    private final ItemMapper itemMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ItemService(
        ItemRepository itemRepository,
        ContextRepository contextRepository,
        ItemMapper itemMapper,
        ItemTextNormalizer itemTextNormalizer,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.contextRepository = contextRepository;
        this.itemMapper = itemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    @Transactional(readOnly = true)
    public ItemResponseDto getItem(UUID id) {
        return itemMapper.toResponse(findItem(id));
    }

    @Transactional
    public ItemResponseDto createItem(CreateItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        Duration time = request.time() == null ? null : request.time().toDuration();
        Item item = new Item(title, request.body(), request.energy(), time);
        item.replaceContexts(findContextsOrThrow(request.contextIds()));
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item created", PersistenceChangeType.CREATE_ITEM);
        return response;
    }

    @Transactional
    public ItemResponseDto updateItem(UUID id, UpdateItemRequestDto request) {
        Item item = findItem(id);
        updateItemFields(item, request);

        if (request.contextIds() != null) {
            item.replaceContexts(findContextsOrThrow(request.contextIds()));
        }

        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("item updated", PersistenceChangeType.UPDATE_ITEM);
        return response;
    }

    private void updateItemFields(Item item, UpdateItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));

        item.setTitle(title);
        item.setBody(request.body());
        item.setEnergy(request.energy());
        item.setTime(request.time() == null ? null : request.time().toDuration());
    }

    @Transactional
    public void deleteItem(UUID id) {
        Item item = findItem(id);
        item.softDelete();
        itemRepository.save(item);
        requestPersistenceSyncAfterCommit("item deleted", PersistenceChangeType.DELETE_ITEM);
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
}
