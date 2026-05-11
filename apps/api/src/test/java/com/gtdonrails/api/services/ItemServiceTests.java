package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ItemAssetRepository;
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
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemServiceTests {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ItemAssetRepository itemAssetRepository;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private AssetSyncService assetSyncService;

    @Mock
    private PersistenceGitSyncService persistenceGitSyncService;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(
            itemRepository,
            itemAssetRepository,
            itemMapper,
            new ItemTextNormalizer(),
            new ItemBodyNormalizer(),
            assetStorageService,
            assetSyncService,
            persistenceGitSyncService,
            new AfterCommitExecutor());
    }

    @Test
    void getItemReturnsMappedItem() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Capture idea"), null);
        ItemResponseDto expectedResponse = itemResponse(itemId, "Capture idea");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        when(itemMapper.toResponse(item)).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.getItem(itemId);

        assertEquals(expectedResponse, response);
    }

    @Test
    void getItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.getItem(itemId));

        assertEquals("item not found", exception.getMessage());
    }

    @Test
    void createItemNormalizesAndSavesStuffOnly() {
        ItemResponseDto expectedResponse = itemResponse("Capture idea later", "line 1\nline 2");
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture\tidea\r\nlater ",
            bodyValue("line 1\r\nline 2")));

        Item savedItem = capturedSavedItem();
        assertEquals("Capture idea later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().text());
        assertNull(savedItem.getNextAction());
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("item created", PersistenceChangeType.CREATE_ITEM);
    }

    @Test
    void createItemThrowsWhenTitleIsInvalid() {
        CreateItemRequestDto request = new CreateItemRequestDto("   ", bodyValue("Body"));

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> itemService.createItem(request));

        assertEquals("title value '' is invalid; expected non-blank text", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemReplacesTitleAndBodyOnly() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("New title", "New body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            " New title ",
            bodyValue("New body")));

        Item savedItem = capturedSavedItem();
        assertEquals("New title", savedItem.getTitle().value());
        assertEquals("New body", savedItem.getBody().text());
        assertNull(savedItem.getNextAction());
        assertEquals(expectedResponse, response);
    }

    @Test
    void patchItemUpdatesOnlyProvidedTitle() throws Exception {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("New title", "Old body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.patchItem(itemId, patchRequest("{\"title\":\" New title \"}"));

        assertEquals("New title", capturedSavedItem().getTitle().value());
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("item metadata updated", PersistenceChangeType.UPDATE_ITEM);
    }

    @Test
    void patchItemBodyRejectsAssetOwnedByOtherItem() {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Title"), null);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(itemAssetRepository.existsByIdAndItemId(assetId, itemId)).thenReturn(false);

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(bodyWithBlockEntity(assetId.toString()))));

        assertEquals(
            "body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'",
            exception.getMessage());
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
        return itemResponse(UUID.randomUUID(), title, body);
    }

    private ItemResponseDto itemResponse(UUID id, String title) {
        return itemResponse(id, title, null);
    }

    private ItemResponseDto itemResponse(UUID id, String title, String body) {
        return new ItemResponseDto(id, title, bodyValue(body), null, null, "STUFF", Instant.now(), List.of());
    }

    private ItemBody bodyValue(String text) {
        return new ItemBody(text, List.of(), List.of(), List.of());
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody("file", List.of(), List.of(), List.of(new BlockEntity("block", "file", 0, 4, assetId, null)));
    }

    private PatchItemRequestDto patchRequest(String json) throws Exception {
        return new PatchItemRequestDto(OBJECT_MAPPER.readTree(json));
    }
}
