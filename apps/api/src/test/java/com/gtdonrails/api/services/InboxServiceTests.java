package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.InboxItemResponseDto;
import com.gtdonrails.api.dtos.UpdateInboxItemRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.mappers.InboxItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
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
class InboxServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private InboxItemMapper inboxItemMapper;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private InboxService inboxService;

    @BeforeEach
    void setUp() {
        inboxService = new InboxService(
            itemRepository,
            inboxItemMapper,
            new ItemTextNormalizer());
    }

    // listStuff
    @Test
    void listStuffReturnsMappedItems() {
        Item olderItem = new Item(new Title("Older item"), null);
        Item newerItem = new Item(new Title("Newer item"), new Body("Body"));
        InboxItemResponseDto olderResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Older item",
            null,
            "STUFF");
        InboxItemResponseDto newerResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Newer item",
            "Body",
            "STUFF");

        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of(newerItem, olderItem));
        when(inboxItemMapper.toResponse(newerItem)).thenReturn(newerResponse);
        when(inboxItemMapper.toResponse(olderItem)).thenReturn(olderResponse);

        List<InboxItemResponseDto> response = inboxService.listStuff();

        assertEquals(List.of(newerResponse, olderResponse), response);
    }

    @Test
    void listStuffReturnsEmptyListWhenRepositoryHasNoItems() {
        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of());

        List<InboxItemResponseDto> response = inboxService.listStuff();

        assertEquals(List.of(), response);
    }

    // getStuff
    @Test
    void getStuffReturnsMappedItem() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Capture idea"), null);
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            itemId,
            "Capture idea",
            null,
            "STUFF");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(item));
        when(inboxItemMapper.toResponse(item)).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.getStuff(itemId);

        assertEquals(expectedResponse, response);
    }

    @Test
    void getStuffThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.empty());

        InboxItemNotFoundException exception = assertThrows(
            InboxItemNotFoundException.class,
            () -> inboxService.getStuff(itemId));

        assertEquals("item not found", exception.getMessage());
    }

    // createStuff
    @Test
    void createStuffNormalizesAndSavesItem() {
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Capture idea later",
            "line 1\nline 2",
            "STUFF");
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.createStuff(new CreateInboxItemRequestDto(
            " Capture\tidea\r\nlater ",
            " line 1\r\nline 2 "));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().value());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createStuffSavesNullBodyWhenNormalizedBodyIsAbsent() {
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Capture idea",
            null,
            "STUFF");
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.createStuff(new CreateInboxItemRequestDto(
            " Capture idea ",
            "   "));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createStuffThrowsWhenTitleIsInvalid() {
        CreateInboxItemRequestDto request = new CreateInboxItemRequestDto("   ", "Body");

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> inboxService.createStuff(request));

        assertEquals("title is required", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    // updateStuff
    @Test
    void updateStuffClearsBodyWhenNormalizedBodyIsAbsent() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), new Body("Old body"));
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            itemId,
            "New title",
            null,
            "STUFF");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto(
            " New title ",
            "   "));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("New title", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateStuffNormalizesAndUpdatesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            itemId,
            "New title later",
            "line 1\nline 2",
            "STUFF");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto(
            " New\t title\r\nlater ",
            " line 1\r\nline 2 "));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("New  title later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().value());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateStuffThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.empty());

        InboxItemNotFoundException exception = assertThrows(
            InboxItemNotFoundException.class,
            () -> inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto("Title", "Body")));

        assertEquals("item not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void updateStuffThrowsWhenTitleIsInvalid() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto("   ", "Body")));

        assertEquals("title is required", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    // deleteStuff
    @Test
    void deleteStuffSoftDeletesAndSavesItem() {
        UUID itemId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Disposable"), null);

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));

        inboxService.deleteStuff(itemId);

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(existingItem, savedItem);
        assertEquals(true, savedItem.isDeleted());
    }

    @Test
    void deleteStuffThrowsNotFoundWhenItemDoesNotExist() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.empty());

        InboxItemNotFoundException exception = assertThrows(
            InboxItemNotFoundException.class,
            () -> inboxService.deleteStuff(itemId));

        assertEquals("item not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }
}
