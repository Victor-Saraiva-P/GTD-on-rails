package com.gtdonrails.api.services;

import java.util.UUID;

import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ItemMapper itemMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final ItemBodyNormalizer itemBodyNormalizer;
    private final ItemAssetService itemAssetService;
    private final DataSyncService dataSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ItemService(
        ItemRepository itemRepository,
        ItemMapper itemMapper,
        ItemTextNormalizer itemTextNormalizer,
        ItemBodyNormalizer itemBodyNormalizer,
        ItemAssetService itemAssetService,
        DataSyncService dataSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.itemMapper = itemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.itemBodyNormalizer = itemBodyNormalizer;
        this.itemAssetService = itemAssetService;
        this.dataSyncService = dataSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
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
        itemAssetService.reconcileBodyAssetReferences(id, body);
        item.setBody(body);
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestDataSyncAfterCommit("item body updated");
        return response;
    }

    /**
     * Updates only the shared item title.
     *
     * <p>Example: {@code itemService.updateItemTitle(itemId, request)}.</p>
     */
    @Transactional
    public ItemResponseDto updateItemTitle(UUID id, UpdateItemTitleRequestDto request) {
        Item item = findItem(id);
        item.setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
        ItemResponseDto response = itemMapper.toResponse(itemRepository.save(item));
        requestCalendarEventUpsertAfterCommit(id, item);
        requestDataSyncAfterCommit("item title updated");
        return response;
    }

    /**
     * Soft deletes an active item and schedules data sync after commit.
     *
     * <p>Example: {@code itemService.deleteItem(itemId)}.</p>
     */
    @Transactional
    public void deleteItem(UUID id) {
        Item item = findItem(id);
        itemAssetService.softDeleteActiveItemAssets(id);
        item.softDelete();
        itemRepository.save(item);
        requestCalendarEventDeleteAfterCommit(id, item);
        requestDataSyncAfterCommit("item deleted");
    }

    /**
     * Restores a soft-deleted item and schedules data sync after commit.
     *
     * <p>Example: {@code itemService.restoreItem(itemId)}.</p>
     */
    @Transactional
    public void restoreItem(UUID id) {
        Item item = itemRepository.findById(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
        item.restore();
        itemAssetService.reconcileBodyAssetReferences(id, item.getBody());
        itemRepository.save(item);
        requestCalendarEventUpsertAfterCommit(id, item);
        requestDataSyncAfterCommit("item restored");
    }

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private void requestDataSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> dataSyncService.requestSync(reason));
    }

    private void requestCalendarEventUpsertAfterCommit(UUID itemId, Item item) {
        if (item.getCalendar() == null && item.getNextAction() == null) return;
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void requestCalendarEventDeleteAfterCommit(UUID itemId, Item item) {
        if (item.getCalendar() == null && item.getNextAction() == null) return;
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestDelete(itemId));
    }

}
