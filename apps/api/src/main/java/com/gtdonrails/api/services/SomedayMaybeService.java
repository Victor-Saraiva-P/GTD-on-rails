package com.gtdonrails.api.services;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.somedaymaybe.SomedayMaybeResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.SomedayMaybeMapper;
import com.gtdonrails.api.repositories.ItemRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SomedayMaybeService {

    private final ItemRepository itemRepository;
    private final SomedayMaybeMapper somedayMaybeMapper;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final CacheInvalidationService cacheInvalidationService;

    public SomedayMaybeService(
        ItemRepository itemRepository,
        SomedayMaybeMapper somedayMaybeMapper,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor,
        CacheInvalidationService cacheInvalidationService
    ) {
        this.itemRepository = itemRepository;
        this.somedayMaybeMapper = somedayMaybeMapper;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.cacheInvalidationService = cacheInvalidationService;
    }

    /**
     * Lists active items in the GTD someday/maybe state.
     *
     * <p>Example: {@code somedayMaybeService.listSomedayMaybe()}.</p>
     */
    @Cacheable(value = CacheNames.SOMEDAY_MAYBE, key = "'active'")
    @Transactional(readOnly = true)
    public List<SomedayMaybeResponseDto> listSomedayMaybe() {
        return itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(ItemStatus.SOMEDAY_MAYBE)
            .stream()
            .map(somedayMaybeMapper::toResponse)
            .toList();
    }

    /**
     * Lists deleted items in the GTD someday/maybe state.
     *
     * <p>Example: {@code somedayMaybeService.listDeletedSomedayMaybe()}.</p>
     */
    @Cacheable(value = CacheNames.SOMEDAY_MAYBE, key = "'deleted'")
    @Transactional(readOnly = true)
    public List<SomedayMaybeResponseDto> listDeletedSomedayMaybe() {
        return itemRepository.findAllByStatusAndDeletedAtIsNotNullOrderByUpdatedAtDesc(ItemStatus.SOMEDAY_MAYBE)
            .stream()
            .map(somedayMaybeMapper::toResponse)
            .toList();
    }

    /**
     * Returns one active someday/maybe item.
     *
     * <p>Example: {@code somedayMaybeService.getSomedayMaybe(id)}.</p>
     */
    @Transactional(readOnly = true)
    public SomedayMaybeResponseDto getSomedayMaybe(UUID id) {
        return somedayMaybeMapper.toResponse(findActiveSomedayMaybe(id));
    }

    /**
     * Reverts one active someday/maybe item back into inbox stuff.
     *
     * <p>Example: {@code somedayMaybeService.revertToStuff(id)}.</p>
     */
    @Transactional
    public void revertToStuff(UUID id) {
        Item item = findActiveSomedayMaybe(id);
        item.revertToStuff();
        itemRepository.save(item);
        requestGoogleCalendarEventSyncAfterCommit(id);
        evictCachesAfterCommit();
    }

    private Item findActiveSomedayMaybe(UUID id) {
        return itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.SOMEDAY_MAYBE)
            .orElseThrow(() -> new ItemNotFoundException(
                "item ID '" + id + "' not found; expected existing active SOMEDAY_MAYBE item"));
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void evictCachesAfterCommit() {
        afterCommitExecutor.run(cacheInvalidationService::evictItemMutation);
    }
}
