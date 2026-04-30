package com.gtdonrails.api.services;

import static com.gtdonrails.api.types.BodyFixtures.paragraphBody;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.ItemTimeRequestDto;
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
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemServiceTests {

    private static BigDecimal energy(String value) {
        return new BigDecimal(value);
    }

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private PersistenceGitSyncService persistenceGitSyncService;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(
            itemRepository,
            contextRepository,
            itemMapper,
            new ItemTextNormalizer(),
            persistenceGitSyncService,
            new AfterCommitExecutor());
    }

    // getItem
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

    // createItem
    @Test
    void createItemNormalizesAndSavesItem() {
        Body body = paragraphBody("line 1\nline 2");
        ItemResponseDto expectedResponse = itemResponse("Capture idea later", body);
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture\tidea\r\nlater ",
            body,
            energy("4.5"),
            new ItemTimeRequestDto(1L, 30),
            null));

        assertSavedTimedItem("Capture idea later", body, "4.5", Duration.ofMinutes(90));
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
        assertNull(savedItem.getBody());
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemThrowsWhenTitleIsInvalid() {
        CreateItemRequestDto request = new CreateItemRequestDto("   ", paragraphBody("Body"), energy("1.0"), null, null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> itemService.createItem(request));

        assertEquals("title is required", exception.getMessage());
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

    // updateItem
    @Test
    void updateItemClearsBodyWhenBodyIsAbsent() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), paragraphBody("Old body"));
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
        Body body = paragraphBody("line 1\nline 2");
        ItemResponseDto expectedResponse = itemResponse(itemId, "New title later", body);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            " New\t title\r\nlater ",
            body,
            energy("7.5"),
            new ItemTimeRequestDto(2L, 15),
            null));

        assertSavedTimedItem("New  title later", body, "7.5", Duration.ofMinutes(135));
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.updateItem(itemId,
                new UpdateItemRequestDto("Title", paragraphBody("Body"), energy("1.0"), null, null)));

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
                new UpdateItemRequestDto("   ", paragraphBody("Body"), energy("1.0"), null, null)));

        assertEquals("title is required", exception.getMessage());
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

    // deleteItem
    @Test
    void deleteItemSoftDeletesAndSavesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Disposable"), null);

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));

        itemService.deleteItem(itemId);

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(existingItem, savedItem);
        assertEquals(true, savedItem.isDeleted());
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

    private ItemResponseDto itemResponse(String title, Body body) {
        return itemResponse(UUID.randomUUID(), title, body);
    }

    private ItemResponseDto itemResponse(UUID id, String title) {
        return itemResponse(id, title, null);
    }

    private ItemResponseDto itemResponse(UUID id, String title, Body body) {
        return new ItemResponseDto(id, title, body, null, null, "STUFF", Instant.now(), List.of());
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
            null,
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
            null,
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

    private void assertSavedTimedItem(String title, Body body, String energyValue, Duration time) {
        Item savedItem = capturedSavedItem();
        assertEquals(title, savedItem.getTitle().value());
        assertEquals(body, savedItem.getBody());
        assertEquals(energy(energyValue), savedItem.getEnergy());
        assertEquals(time, savedItem.getTime());
    }

    private void assertSavedItemClearedBody() {
        Item savedItem = capturedSavedItem();
        assertEquals("New title", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(energy("3.0"), savedItem.getEnergy());
        assertNull(savedItem.getTime());
    }

    private void assertSavedItemHasHomeContext() {
        Item savedItem = capturedSavedItem();
        assertSavedItemHasContext(savedItem, "home");
        assertEquals(energy("5.0"), savedItem.getEnergy());
        assertNull(savedItem.getTime());
    }

    private void assertSavedItemHasContext(Item savedItem, String name) {
        assertEquals(1, savedItem.getContexts().size());
        assertEquals(name, savedItem.getContexts().iterator().next().getName());
    }

    private void assertSavedItemKeptOfficeContext() {
        Item savedItem = capturedSavedItem();
        assertSavedItemHasContext(savedItem, "office");
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getTime());
    }
}
