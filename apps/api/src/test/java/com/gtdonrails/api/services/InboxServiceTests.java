package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class InboxServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ItemMapper itemMapper;

    private InboxService inboxService;

    @BeforeEach
    void setUp() {
        inboxService = new InboxService(itemRepository, itemMapper);
    }

    @Test
    void listStuffReturnsMappedItems() {
        Item olderItem = new Item(new Title("Older item"), null);
        Item newerItem = new Item(new Title("Newer item"), new Body("Body"));
        ItemResponseDto olderResponse = itemResponse("Older item", null, "1.0");
        ItemResponseDto newerResponse = itemResponse("Newer item", "Body", "2.5");

        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of(newerItem, olderItem));
        when(itemMapper.toResponse(newerItem)).thenReturn(newerResponse);
        when(itemMapper.toResponse(olderItem)).thenReturn(olderResponse);

        List<ItemResponseDto> response = inboxService.listStuff();

        assertEquals(List.of(newerResponse, olderResponse), response);
    }

    @Test
    void listStuffReturnsEmptyListWhenRepositoryHasNoItems() {
        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of());

        List<ItemResponseDto> response = inboxService.listStuff();

        assertEquals(List.of(), response);
    }

    private ItemResponseDto itemResponse(String title, String body, String energy) {
        return new ItemResponseDto(
            UUID.randomUUID(),
            title,
            body,
            new BigDecimal(energy),
            null,
            "STUFF",
            Instant.now(),
            List.of());
    }
}
