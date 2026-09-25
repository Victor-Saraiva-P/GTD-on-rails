package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.somedaymaybe.SomedayMaybeResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.SomedayMaybeMapper;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class SomedayMaybeServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private SomedayMaybeMapper somedayMaybeMapper;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    private SomedayMaybeService somedayMaybeService;

    @BeforeEach
    void setUp() {
        somedayMaybeService = new SomedayMaybeService(
            itemRepository,
            somedayMaybeMapper,
            googleCalendarEventQueueService,
            new AfterCommitExecutor(),
            cacheInvalidationService
        );
    }

    @Test
    void listSomedayMaybeReturnsMappedItems() {
        Item item = createSomedayMaybeItem("Learn French");
        SomedayMaybeResponseDto dto = createDto(item.getId(), "Learn French");

        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(List.of(item));
        when(somedayMaybeMapper.toListResponse(item)).thenReturn(dto);

        List<SomedayMaybeResponseDto> result = somedayMaybeService.listSomedayMaybe();

        assertEquals(List.of(dto), result);
    }

    @Test
    void listDeletedSomedayMaybeReturnsMappedItems() {
        Item item = createSomedayMaybeItem("Deleted hobby");
        SomedayMaybeResponseDto dto = createDto(item.getId(), "Deleted hobby");

        when(itemRepository.findAllByStatusAndDeletedAtIsNotNullOrderByUpdatedAtDesc(ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(List.of(item));
        when(somedayMaybeMapper.toListResponse(item)).thenReturn(dto);

        List<SomedayMaybeResponseDto> result = somedayMaybeService.listDeletedSomedayMaybe();

        assertEquals(List.of(dto), result);
    }

    @Test
    void getSomedayMaybeReturnsMappedItem() {
        UUID id = UUID.randomUUID();
        Item item = createSomedayMaybeItem("Read Dune");
        SomedayMaybeResponseDto dto = createDto(id, "Read Dune");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(Optional.of(item));
        when(somedayMaybeMapper.toResponse(item)).thenReturn(dto);

        SomedayMaybeResponseDto result = somedayMaybeService.getSomedayMaybe(id);

        assertEquals(dto, result);
    }

    @Test
    void getSomedayMaybeThrowsWhenNotFound() {
        UUID id = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(Optional.empty());

        ItemNotFoundException ex = assertThrows(
            ItemNotFoundException.class,
            () -> somedayMaybeService.getSomedayMaybe(id)
        );

        assertEquals("item ID '" + id + "' not found; expected existing active SOMEDAY_MAYBE item", ex.getMessage());
    }

    @Test
    void revertToStuffRevertsStatusAndEvictsCache() {
        UUID id = UUID.randomUUID();
        Item item = createSomedayMaybeItem("Idea to do now");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(Optional.of(item));

        somedayMaybeService.revertToStuff(id);

        assertEquals(ItemStatus.STUFF, item.getStatus());
        verify(itemRepository).save(item);
        verify(googleCalendarEventQueueService).requestUpsert(id);
        verify(cacheInvalidationService).evictItemMutation();
    }

    @Test
    void revertToStuffThrowsWhenNotFound() {
        UUID id = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.SOMEDAY_MAYBE))
            .thenReturn(Optional.empty());

        ItemNotFoundException ex = assertThrows(
            ItemNotFoundException.class,
            () -> somedayMaybeService.revertToStuff(id)
        );

        assertEquals("item ID '" + id + "' not found; expected existing active SOMEDAY_MAYBE item", ex.getMessage());
    }

    private Item createSomedayMaybeItem(String title) {
        Item item = new Item(new Title(title), null);
        item.convertToSomedayMaybe();
        return item;
    }

    private SomedayMaybeResponseDto createDto(UUID id, String title) {
        return new SomedayMaybeResponseDto(id, title, ItemBody.empty(), "SOMEDAY_MAYBE", Instant.now(), null, null);
    }
}
