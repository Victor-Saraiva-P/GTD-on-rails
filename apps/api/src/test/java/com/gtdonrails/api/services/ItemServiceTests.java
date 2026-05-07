package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.ItemTimeRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemServiceTests {

    private static BigDecimal energy(String value) {
        return new BigDecimal(value);
    }

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ContextRepository contextRepository;

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
            contextRepository,
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
    void createItemNormalizesAndSavesItem() {
        String body = "line 1\r\nline 2";
        ItemResponseDto expectedResponse = itemResponse("Capture idea later", "line 1\nline 2");
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture\tidea\r\nlater ",
            bodyValue(body),
            energy("4.5"),
            new ItemTimeRequestDto(1L, 30),
            null));

        assertSavedTimedItem("Capture idea later", "line 1\nline 2", "4.5", Duration.ofMinutes(90));
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("item created", PersistenceChangeType.CREATE_ITEM);
    }

    @Test
    void createItemAssignsContextsToItem() {
        UUID notebookId = UUID.randomUUID();
        UUID streetId = UUID.randomUUID();
        Context notebook = new Context("notebook");
        Context street = new Context("street");
        ItemResponseDto expectedResponse = itemResponseWithContexts(notebookId, streetId);

        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(notebook, street));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.createItem(createItemWithContextsRequest(notebookId, streetId));

        assertEquals(2, capturedSavedItem().getContexts().size());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemSavesNullBodyWhenBodyIsAbsent() {
        ItemResponseDto expectedResponse = itemResponse("Capture idea", null);
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture idea ",
            null,
            null,
            null,
            null));

        Item savedItem = capturedSavedItem();
        assertEquals("Capture idea", savedItem.getTitle().value());
        assertEquals("", savedItem.getBody().text());
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getEstimatedTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemThrowsWhenTitleIsInvalid() {
        CreateItemRequestDto request = new CreateItemRequestDto("   ", bodyValue("Body"), energy("1.0"), null, null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> itemService.createItem(request));

        assertEquals("title value '' is invalid; expected non-blank text", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void createItemThrowsWhenContextDoesNotExist() {
        UUID missingContextId = UUID.randomUUID();

        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> itemService.createItem(new CreateItemRequestDto(
                "Capture idea",
                null,
                energy("1.0"),
                null,
                List.of(missingContextId))));

        assertEquals("context not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemClearsBodyWhenBodyIsAbsent() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse(itemId, "New title");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, clearBodyUpdateRequest());

        assertSavedItemClearedBody();
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemReplacesContexts() {
        UUID itemId = UUID.randomUUID();
        UUID homeId = UUID.randomUUID();
        Item existingItem = oldItemWithContext();
        Context home = new Context("home");
        ItemResponseDto expectedResponse = itemResponseWithContext(itemId, homeId);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(home));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, updateItemWithContextRequest(homeId));

        assertSavedItemHasHomeContext();
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("item updated", PersistenceChangeType.UPDATE_ITEM);
    }

    @Test
    void updateItemNormalizesAndUpdatesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        String body = "line 1\r\nline 2";
        ItemResponseDto expectedResponse = itemResponse(itemId, "New title later", "line 1\nline 2");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, normalizedUpdateRequest(body));

        assertSavedTimedItem("New  title later", "line 1\nline 2", "7.5", Duration.ofMinutes(135));
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.updateItem(itemId,
                new UpdateItemRequestDto("Title", bodyValue("Body"), energy("1.0"), null, null)));

        assertEquals("item not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemThrowsWhenTitleIsInvalid() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> itemService.updateItem(itemId,
                new UpdateItemRequestDto("   ", bodyValue("Body"), energy("1.0"), null, null)));

        assertEquals("title value '' is invalid; expected non-blank text", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemPreservesContextsWhenContextIdsAreOmitted() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        Context office = new Context("office");
        existingItem.addContext(office);
        ItemResponseDto expectedResponse = itemResponseWithOffice(itemId);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, updateItemWithoutContextsRequest());

        assertSavedItemKeptOfficeContext();
        assertEquals(expectedResponse, response);
        verify(contextRepository, never()).findAllByIdInAndDeletedAtIsNull(any());
    }

    @Test
    void patchItemBodyUpdatesOnlyBody() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), "Old body", energy("2.0"), Duration.ofMinutes(30));
        ItemResponseDto expectedResponse = itemResponse(itemId, "Old title", "New body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(bodyValue("New body")));

        Item savedItem = capturedSavedItem();
        assertEquals("Old title", savedItem.getTitle().value());
        assertEquals("New body", savedItem.getBody().text());
        assertEquals(energy("2.0"), savedItem.getEnergy());
        assertEquals(Duration.ofMinutes(30), savedItem.getEstimatedTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void patchItemPreservesOmittedContextsAndUpdatesEnergy() throws Exception {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        existingItem.addContext(new Context("office"));

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(itemResponse(itemId, "Old title"));

        itemService.patchItem(itemId, patchRequest("{\"energy\":4.5}"));

        Item savedItem = capturedSavedItem();
        assertEquals(energy("4.5"), savedItem.getEnergy());
        assertEquals(1, savedItem.getContexts().size());
        verify(contextRepository, never()).findAllByIdInAndDeletedAtIsNull(any());
    }

    @Test
    void patchItemClearsContextsWithEmptyArray() throws Exception {
        UUID itemId = UUID.randomUUID();
        Item existingItem = oldItemWithContext();

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(itemResponse(itemId, "Old title"));

        itemService.patchItem(itemId, patchRequest("{\"contextIds\":[]}"));

        assertEquals(0, capturedSavedItem().getContexts().size());
    }

    @Test
    void deleteItemSoftDeletesAndSavesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Disposable"), null);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));

        itemService.deleteItem(itemId);

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(existingItem, savedItem);
        assertTrue(savedItem.isDeleted());
        verify(persistenceGitSyncService).requestSync("item deleted", PersistenceChangeType.DELETE_ITEM);
    }

    @Test
    void deleteItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.deleteItem(itemId));

        assertEquals("item not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void restoreItemClearsDeletedFlag() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Restore"), null);
        item.softDelete();

        when(itemRepository.findById(itemId)).thenReturn(Optional.of(item));

        itemService.restoreItem(itemId);

        verify(itemRepository).save(itemCaptor.capture());
        assertFalse(itemCaptor.getValue().isDeleted());
        verify(persistenceGitSyncService).requestSync("item restored", PersistenceChangeType.UPDATE_ITEM);
    }

    @Test
    void restoreItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();

        when(itemRepository.findById(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.restoreItem(itemId));

        assertEquals("item not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void storeItemAssetReturnsAssetMetadata() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Asset item"), null);
        MockMultipartFile file = pdfAssetFile();
        String relativePath = "items/" + itemId + "/asset-id/file.pdf";

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        when(assetStorageService.storeItemAsset(itemId, file)).thenReturn(relativePath);
        when(assetStorageService.publicUrl(relativePath)).thenReturn("/assets/" + relativePath);
        when(assetStorageService.fileName(relativePath)).thenReturn("file.pdf");
        when(assetStorageService.mediaType(relativePath)).thenReturn(MediaType.APPLICATION_PDF);
        when(assetStorageService.isImage(relativePath)).thenReturn(false);
        when(itemAssetRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ItemAssetResponseDto response = itemService.storeItemAsset(itemId, file);

        assertEquals(relativePath, response.relativePath());
        assertEquals("file.pdf", response.fileName());
        assertEquals("application/pdf", response.contentType());
        assertFalse(response.image());
        verify(assetSyncService).requestSync("item asset uploaded");
    }

    @Test
    void storeItemAssetThrowsWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.storeItemAsset(itemId, pdfAssetFile()));

        assertEquals("item not found", exception.getMessage());
        verify(assetStorageService, never()).storeItemAsset(any(), any());
    }

    @Test
    void createItemRejectsBlockEntitiesBeforeAssetUpload() {
        CreateItemRequestDto request = new CreateItemRequestDto(
            "Capture file",
            bodyWithBlockEntity(UUID.randomUUID().toString()),
            null,
            null,
            null);

        BusinessException exception = assertThrows(BusinessException.class, () -> itemService.createItem(request));

        assertEquals("body.blockEntities value is invalid; expected uploaded assets on an existing item", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemRejectsMissingBlockEntityAsset() {
        UUID itemId = UUID.randomUUID();
        String assetId = UUID.randomUUID().toString();

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(new Item(new Title("Title"), null)));

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> itemService.updateItem(itemId, new UpdateItemRequestDto("Title", bodyWithBlockEntity(assetId), null, null, null)));

        assertEquals("body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemAcceptsOwnedBlockEntityAsset() {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        ItemResponseDto expectedResponse = itemResponse(itemId, "Title", "see asset");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(new Item(new Title("Title"), null)));
        when(itemAssetRepository.existsByIdAndItemId(assetId, itemId)).thenReturn(true);
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(
            itemId,
            new UpdateItemRequestDto("Title", bodyWithBlockEntity(assetId.toString()), null, null, null));

        assertEquals(expectedResponse, response);
        assertEquals(assetId.toString(), capturedSavedItem().getBody().blockEntities().getFirst().assetId());
    }

    @Test
    void createItemRequestsPersistenceSyncOnlyAfterCommitWhenTransactionSynchronizationIsActive() {
        stubSavedItemResponse(itemResponse("Capture idea", null));

        TransactionSynchronizationManager.initSynchronization();
        try {
            itemService.createItem(new CreateItemRequestDto("Capture idea", null, null, null, null));

            verify(persistenceGitSyncService, never()).requestSync("item created", PersistenceChangeType.CREATE_ITEM);

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCommit();
            }

            verify(persistenceGitSyncService).requestSync("item created", PersistenceChangeType.CREATE_ITEM);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void createItemDoesNotRequestPersistenceSyncWithoutCommitWhenTransactionSynchronizationIsActive() {
        stubSavedItemResponse(itemResponse("Capture idea", null));

        TransactionSynchronizationManager.initSynchronization();
        try {
            itemService.createItem(new CreateItemRequestDto("Capture idea", null, null, null, null));

            verify(persistenceGitSyncService, never()).requestSync("item created", PersistenceChangeType.CREATE_ITEM);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private ItemResponseDto itemResponse(String title, String body) {
        return itemResponse(UUID.randomUUID(), title, body);
    }

    private MockMultipartFile pdfAssetFile() {
        return new MockMultipartFile("file", "file.pdf", "application/pdf", new byte[] {1, 2, 3});
    }

    private ItemResponseDto itemResponse(UUID id, String title) {
        return itemResponse(id, title, null);
    }

    private ItemResponseDto itemResponse(UUID id, String title, String body) {
        return new ItemResponseDto(id, title, bodyValue(body), null, null, "STUFF", Instant.now(), List.of());
    }

    private ItemResponseDto itemResponseWithContexts(UUID notebookId, UUID streetId) {
        return new ItemResponseDto(
            UUID.randomUUID(),
            "Capture idea",
            null,
            energy("2.0"),
            null,
            "STUFF",
            Instant.now(),
            List.of(
                new ContextResponseDto(notebookId, "notebook", null),
                new ContextResponseDto(streetId, "street", null)));
    }

    private ItemResponseDto itemResponseWithContext(UUID itemId, UUID contextId) {
        return new ItemResponseDto(
            itemId,
            "New title",
            bodyValue(null),
            energy("5.0"),
            null,
            "STUFF",
            Instant.now(),
            List.of(new ContextResponseDto(contextId, "home", null)));
    }

    private ItemResponseDto itemResponseWithOffice(UUID itemId) {
        return new ItemResponseDto(
            itemId,
            "New title",
            bodyValue(null),
            null,
            null,
            "STUFF",
            Instant.now(),
            List.of(new ContextResponseDto(UUID.randomUUID(), "office", null)));
    }

    private void stubSavedItemResponse(ItemResponseDto expectedResponse) {
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);
    }

    private ItemBody bodyValue(String text) {
        return new ItemBody(text, List.of(), List.of(), List.of());
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody(
            "see asset",
            List.of(),
            List.of(),
            List.of(new BlockEntity("b1", "pdf", 0, 9, assetId, null)));
    }

    private PatchItemRequestDto patchRequest(String json) throws Exception {
        return new PatchItemRequestDto(OBJECT_MAPPER.readTree(json));
    }

    private CreateItemRequestDto createItemWithContextsRequest(UUID notebookId, UUID streetId) {
        return new CreateItemRequestDto(
            "Capture idea",
            null,
            energy("2.0"),
            null,
            List.of(notebookId, streetId));
    }

    private UpdateItemRequestDto updateItemWithContextRequest(UUID homeId) {
        return new UpdateItemRequestDto("New title", null, energy("5.0"), null, List.of(homeId));
    }

    private UpdateItemRequestDto updateItemWithoutContextsRequest() {
        return new UpdateItemRequestDto("New title", null, null, null, null);
    }

    private UpdateItemRequestDto normalizedUpdateRequest(String body) {
        return new UpdateItemRequestDto(
            " New\t title\r\nlater ",
            bodyValue(body),
            energy("7.5"),
            new ItemTimeRequestDto(2L, 15),
            null);
    }

    private UpdateItemRequestDto clearBodyUpdateRequest() {
        return new UpdateItemRequestDto(" New title ", null, energy("3.0"), null, null);
    }

    private Item oldItemWithContext() {
        Item item = new Item(new Title("Old title"), null);
        item.addContext(new Context("old"));
        return item;
    }

    private Item capturedSavedItem() {
        verify(itemRepository).save(itemCaptor.capture());
        return itemCaptor.getValue();
    }

    private void assertSavedTimedItem(String title, String body, String energyValue, Duration time) {
        Item savedItem = capturedSavedItem();
        assertEquals(title, savedItem.getTitle().value());
        assertEquals(body, savedItem.getBody().text());
        assertEquals(energy(energyValue), savedItem.getEnergy());
        assertEquals(time, savedItem.getEstimatedTime());
    }

    private void assertSavedItemClearedBody() {
        Item savedItem = capturedSavedItem();
        assertEquals("New title", savedItem.getTitle().value());
        assertEquals("", savedItem.getBody().text());
        assertEquals(energy("3.0"), savedItem.getEnergy());
        assertNull(savedItem.getEstimatedTime());
    }

    private void assertSavedItemHasHomeContext() {
        Item savedItem = capturedSavedItem();
        assertSavedItemHasContext(savedItem, "home");
        assertEquals(energy("5.0"), savedItem.getEnergy());
        assertNull(savedItem.getEstimatedTime());
    }

    private void assertSavedItemHasContext(Item savedItem, String name) {
        assertEquals(1, savedItem.getContexts().size());
        assertEquals(name, savedItem.getContexts().iterator().next().getName());
    }

    private void assertSavedItemKeptOfficeContext() {
        Item savedItem = capturedSavedItem();
        assertSavedItemHasContext(savedItem, "office");
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getEstimatedTime());
    }
}
