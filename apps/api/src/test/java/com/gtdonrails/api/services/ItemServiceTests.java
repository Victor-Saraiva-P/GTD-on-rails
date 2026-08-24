package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private ItemAssetService itemAssetService;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private ItemService itemService;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(
            itemRepository,
            itemMapper,
            new ItemTextNormalizer(),
            new ItemBodyNormalizer(),
            itemAssetService,
            googleCalendarEventQueueService,
            new AfterCommitExecutor());
    }

    @Test
    void updateItemTitleNormalizesAndSavesTitleOnly() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("New title", "Old body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItemTitle(itemId, new UpdateItemTitleRequestDto(" New\ttitle "));

        assertEquals("New title", capturedSavedItem().getTitle().value());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemTitleQueuesCalendarEventWhenItemIsCalendar() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        item.convertToCalendar(java.time.LocalDate.now(), null);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(itemResponse("New title", "Old body"));

        itemService.updateItemTitle(itemId, new UpdateItemTitleRequestDto("New title"));

        verify(googleCalendarEventQueueService).requestUpsert(itemId);
    }

    @Test
    void updateItemTitleQueuesCalendarEventWhenItemIsNextAction() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        item.convertToNextAction(new java.math.BigDecimal("5.0"), java.time.Duration.ofMinutes(30), java.util.Set.of());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(itemResponse("New title", "Old body"));

        itemService.updateItemTitle(itemId, new UpdateItemTitleRequestDto("New title"));

        verify(googleCalendarEventQueueService).requestUpsert(itemId);
    }

    @Test
    void patchItemBodyUpdatesOnlyBody() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("Old title", "New body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(bodyValue("New body")));

        Item savedItem = capturedSavedItem();
        assertEquals("Old title", savedItem.getTitle().value());
        assertEquals("New body", savedItem.getBody().text());
        assertEquals(expectedResponse, response);
        verify(itemAssetService).reconcileBodyAssetReferences(itemId, bodyValue("New body"));
        verify(googleCalendarEventQueueService, never()).requestUpsert(itemId);
    }

    @Test
    void patchItemBodyReconcilesAssetReferences() {
        UUID itemId = UUID.randomUUID();
        ItemBody body = bodyWithBlockEntity(UUID.randomUUID().toString());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId))
            .thenReturn(Optional.of(new Item(new Title("Title"), null)));
        stubSavedItemResponse(itemResponse("Title", "file"));

        itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(body));

        verify(itemAssetService).reconcileBodyAssetReferences(itemId, body);
    }

    @Test
    void deleteItemSoftDeletesActiveItemAssetsAndSyncsCalendar() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Title"), null);
        item.convertToCalendar(java.time.LocalDate.now(), java.time.LocalTime.now());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));

        itemService.deleteItem(itemId);

        assertTrue(item.isDeleted());
        verify(itemAssetService).softDeleteActiveItemAssets(itemId);
        verify(googleCalendarEventQueueService).requestDelete(itemId);
    }

    @Test
    void deleteItemSoftDeletesActiveItemAssetsAndSyncsNextAction() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Title"), null);
        item.convertToNextAction(new java.math.BigDecimal("5.0"), java.time.Duration.ofMinutes(30), java.util.Set.of());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));

        itemService.deleteItem(itemId);

        verify(googleCalendarEventQueueService).requestDelete(itemId);
    }

    @Test
    void restoreItemRestoresReferencedBodyAssetsAndSyncsCalendar() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Title"), null);
        item.convertToCalendar(java.time.LocalDate.now(), java.time.LocalTime.now());
        item.softDelete();

        when(itemRepository.findById(itemId)).thenReturn(Optional.of(item));

        itemService.restoreItem(itemId);

        assertFalse(item.isDeleted());
        verify(itemAssetService).reconcileBodyAssetReferences(itemId, item.getBody());
        verify(googleCalendarEventQueueService).requestUpsert(itemId);
    }

    @Test
    void restoreItemRestoresReferencedBodyAssetsAndSyncsNextAction() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Title"), null);
        item.convertToNextAction(new java.math.BigDecimal("5.0"), java.time.Duration.ofMinutes(30), java.util.Set.of());
        item.softDelete();

        when(itemRepository.findById(itemId)).thenReturn(Optional.of(item));

        itemService.restoreItem(itemId);

        verify(googleCalendarEventQueueService).requestUpsert(itemId);
    }

    private void stubSavedItemResponse(ItemResponseDto response) {
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(response);
    }

    private Item capturedSavedItem() {
        verify(itemRepository).save(itemCaptor.capture());
        return itemCaptor.getValue();
    }

    private ItemResponseDto itemResponse(String title, String body) {
        return new ItemResponseDto(UUID.randomUUID(), title, bodyValue(body), null, null, "STUFF", Instant.now(), List.of());
    }

    private ItemBody bodyValue(String text) {
        return new ItemBody(text, List.of(), List.of(), List.of());
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody("file", List.of(), List.of(), List.of(new BlockEntity("block", "file", 0, 4, assetId, null)));
    }
}
