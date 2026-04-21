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

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.inbox.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.inbox.InboxItemResponseDto;
import com.gtdonrails.api.dtos.inbox.UpdateInboxItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.mappers.InboxItemMapper;
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
class InboxServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private InboxItemMapper inboxItemMapper;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private InboxService inboxService;

    @BeforeEach
    void setUp() {
        inboxService = new InboxService(
            itemRepository,
            contextRepository,
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
            "STUFF",
            List.of());
        InboxItemResponseDto newerResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Newer item",
            "Body",
            "STUFF",
            List.of());

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
            "STUFF",
            List.of());

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
            "STUFF",
            List.of());
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.createStuff(new CreateInboxItemRequestDto(
            " Capture\tidea\r\nlater ",
            " line 1\r\nline 2 ",
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea later", savedItem.getTitle().value());
        assertEquals("line 1\nline 2", savedItem.getBody().value());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createStuffAssignsContextsToItem() {
        UUID notebookId = UUID.randomUUID();
        UUID streetId = UUID.randomUUID();
        Context notebook = new Context("notebook");
        Context street = new Context("street");
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Capture idea",
            null,
            "STUFF",
            List.of(
                new ContextResponseDto(notebookId, "notebook"),
                new ContextResponseDto(streetId, "street")));

        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(notebook, street));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.createStuff(new CreateInboxItemRequestDto(
            "Capture idea",
            null,
            List.of(notebookId, streetId)));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(2, savedItem.getContexts().size());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createStuffSavesNullBodyWhenNormalizedBodyIsAbsent() {
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            UUID.randomUUID(),
            "Capture idea",
            null,
            "STUFF",
            List.of());
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.createStuff(new CreateInboxItemRequestDto(
            " Capture idea ",
            "   ",
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("Capture idea", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createStuffThrowsWhenTitleIsInvalid() {
        CreateInboxItemRequestDto request = new CreateInboxItemRequestDto("   ", "Body", null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> inboxService.createStuff(request));

        assertEquals("title is required", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void createStuffThrowsWhenContextDoesNotExist() {
        UUID missingContextId = UUID.randomUUID();

        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> inboxService.createStuff(new CreateInboxItemRequestDto(
                "Capture idea",
                null,
                List.of(missingContextId))));

        assertEquals("context not found", exception.getMessage());
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
            "STUFF",
            List.of());

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto(
            " New title ",
            "   ",
            null));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals("New title", savedItem.getTitle().value());
        assertNull(savedItem.getBody());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateStuffReplacesContexts() {
        UUID itemId = UUID.randomUUID();
        UUID homeId = UUID.randomUUID();
        Item existingItem = new Item(new Title("Old title"), null);
        existingItem.addContext(new Context("old"));
        Context home = new Context("home");
        InboxItemResponseDto expectedResponse = new InboxItemResponseDto(
            itemId,
            "New title",
            null,
            "STUFF",
            List.of(new ContextResponseDto(homeId, "home")));

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));
        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any()))
            .thenReturn(List.of(home));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto(
            "New title",
            null,
            List.of(homeId)));

        verify(itemRepository).save(itemCaptor.capture());
        Item savedItem = itemCaptor.getValue();
        assertEquals(1, savedItem.getContexts().size());
        assertEquals("home", savedItem.getContexts().iterator().next().getName());
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
            "STUFF",
            List.of());

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(itemId, ItemStatus.STUFF))
            .thenReturn(Optional.of(existingItem));
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inboxItemMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        InboxItemResponseDto response = inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto(
            " New\t title\r\nlater ",
            " line 1\r\nline 2 ",
            null));

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
            () -> inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto("Title", "Body", null)));

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
            () -> inboxService.updateStuff(itemId, new UpdateInboxItemRequestDto("   ", "Body", null)));

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
