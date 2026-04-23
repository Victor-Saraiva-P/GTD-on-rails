package com.gtdonrails.api.services;

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
import com.gtdonrails.api.dtos.item.ItemTimeDto;
import com.gtdonrails.api.dtos.item.ItemTimeRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
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

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(
            itemRepository,
            contextRepository,
            itemMapper,
            new ItemTextNormalizer());
    }

    // getItem
    @Test
    void getItemReturnsMappedItem() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Capture idea"), null);
        ItemResponseDto expectedResponse = new ItemResponseDto(
            itemId,
            "Capture idea",
            null,
            null,
            null,
            "STUFF",
            Instant.now(),
            List.of());

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
        ItemResponseDto expectedResponse = new ItemResponseDto(
            UUID.randomUUID(),
            "Capture idea later",
            "line 1\nline 2",
            energy("4.5"),
            new ItemTimeDto(1, 30),
            "STUFF",
            Instant.now(),
            List.of());
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture\tidea\r\nlater ",
            " line 1\r\nline 2 ",
            energy("4.5"),
            new ItemTimeRequestDto(1L, 30),
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().value());
        assertEquals(energy("4.5"), savedItem.getEnergy());
        assertEquals(Duration.ofMinutes(90), savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemAssignsContextsToItem() {
        UUID notebookId = UUID.randomUUID();
        UUID streetId = UUID.randomUUID();
        Context notebook = new Context("notebook");
        Context street = new Context("street");
        ItemResponseDto expectedResponse = new ItemResponseDto(
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

        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(notebook, street));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            "Capture idea",
            null,
            energy("2.0"),
            null,
            List.of(notebookId, streetId)));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(2, savedItem.getContexts().size());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemSavesNullBodyWhenNormalizedBodyIsAbsent() {
        ItemResponseDto expectedResponse = new ItemResponseDto(
            UUID.randomUUID(),
            "Capture idea",
            null,
            null,
            null,
            "STUFF",
            Instant.now(),
            List.of());
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.createItem(new CreateItemRequestDto(
            " Capture idea ",
            "   ",
            null,
            null,
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createItemThrowsWhenTitleIsInvalid() {
        CreateItemRequestDto request = new CreateItemRequestDto("   ", "Body", energy("1.0"), null, null);

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
    void updateItemClearsBodyWhenNormalizedBodyIsAbsent() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), new Body("Old body"));
        ItemResponseDto expectedResponse = new ItemResponseDto(
            itemId,
            "New title",
            null,
            energy("3.0"),
            null,
            "STUFF",
            Instant.now(),
            List.of());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            " New title ",
            "   ",
            energy("3.0"),
            null,
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("New title", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(energy("3.0"), savedItem.getEnergy());
        assertNull(savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemReplacesContexts() {
        UUID itemId = UUID.randomUUID();
        UUID homeId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        existingItem.addContext(new Context("old"));
        Context home = new Context("home");
        ItemResponseDto expectedResponse = new ItemResponseDto(
            itemId,
            "New title",
            null,
            energy("5.0"),
            null,
            "STUFF",
            Instant.now(),
            List.of(new ContextResponseDto(homeId, "home", null)));

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(home));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            "New title",
            null,
            energy("5.0"),
            null,
            List.of(homeId)));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(1, savedItem.getContexts().size());
        assertEquals("home", savedItem.getContexts().iterator().next().getName());
        assertEquals(energy("5.0"), savedItem.getEnergy());
        assertNull(savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemNormalizesAndUpdatesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        ItemResponseDto expectedResponse = new ItemResponseDto(
            itemId,
            "New title later",
            "line 1\nline 2",
            energy("7.5"),
            new ItemTimeDto(2, 15),
            "STUFF",
            Instant.now(),
            List.of());

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            " New\t title\r\nlater ",
            " line 1\r\nline 2 ",
            energy("7.5"),
            new ItemTimeRequestDto(2L, 15),
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("New  title later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().value());
        assertEquals(energy("7.5"), savedItem.getEnergy());
        assertEquals(Duration.ofMinutes(135), savedItem.getTime());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateItemThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> itemService.updateItem(itemId, new UpdateItemRequestDto("Title", "Body", energy("1.0"), null, null)));

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
            () -> itemService.updateItem(itemId, new UpdateItemRequestDto("   ", "Body", energy("1.0"), null, null)));

        assertEquals("title is required", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateItemPreservesContextsWhenContextIdsAreOmitted() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        Context office = new Context("office");
        existingItem.addContext(office);
        ItemResponseDto expectedResponse = new ItemResponseDto(
            itemId,
            "New title",
            null,
            null,
            null,
            "STUFF",
            Instant.now(),
            List.of(new ContextResponseDto(UUID.randomUUID(), "office", null)));

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        ItemResponseDto response = itemService.updateItem(itemId, new UpdateItemRequestDto(
            "New title",
            null,
            null,
            null,
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(1, savedItem.getContexts().size());
        assertEquals("office", savedItem.getContexts().iterator().next().getName());
        assertNull(savedItem.getEnergy());
        assertNull(savedItem.getTime());
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
}
