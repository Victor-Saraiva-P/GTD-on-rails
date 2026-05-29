package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.ConvertStuffToCalendarRequestDto;
import com.gtdonrails.api.dtos.inbox.ConvertStuffToNextActionRequestDto;
import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.inbox.StuffResponseDto;
import com.gtdonrails.api.dtos.item.ItemTimeRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.StuffMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
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
class InboxServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private StuffMapper stuffMapper;

    @Mock
    private PersistenceGitSyncService persistenceGitSyncService;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private InboxService inboxService;

    @BeforeEach
    void setUp() {
        inboxService = new InboxService(
            itemRepository,
            contextRepository,
            stuffMapper,
            new ItemTextNormalizer(),
            persistenceGitSyncService,
            googleCalendarEventQueueService,
            new AfterCommitExecutor());
    }

    @Test
    void listStuffReturnsMappedStuff() {
        Item stuff = new Item(new Title("Capture idea"), null);
        StuffResponseDto expectedResponse = stuffResponse("Capture idea");

        when(itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of(stuff));
        when(stuffMapper.toResponse(stuff)).thenReturn(expectedResponse);

        List<StuffResponseDto> response = inboxService.listStuff();

        assertEquals(List.of(expectedResponse), response);
    }

    @Test
    void listDeletedStuffReturnsMappedStuff() {
        Item stuff = new Item(new Title("Deleted idea"), null);
        StuffResponseDto expectedResponse = stuffResponse("Deleted idea");

        when(itemRepository.findAllByStatusAndDeletedAtIsNotNullOrderByUpdatedAtDesc(ItemStatus.STUFF))
            .thenReturn(List.of(stuff));
        when(stuffMapper.toResponse(stuff)).thenReturn(expectedResponse);

        List<StuffResponseDto> response = inboxService.listDeletedStuff();

        assertEquals(List.of(expectedResponse), response);
    }

    @Test
    void getStuffThrowsWhenItemIsNotStuff() {
        UUID stuffId = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF)).thenReturn(Optional.empty());

        ItemNotFoundException exception = assertThrows(
            ItemNotFoundException.class,
            () -> inboxService.getStuff(stuffId));

        assertEquals("stuff not found", exception.getMessage());
    }

    @Test
    void createStuffNormalizesAndSavesTitleOnly() {
        StuffResponseDto expectedResponse = stuffResponse("Capture idea later");

        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stuffMapper.toResponse(any(Item.class))).thenReturn(expectedResponse);

        StuffResponseDto response = inboxService.createStuff(new CreateStuffRequestDto(" Capture\tidea\r\nlater "));

        verify(itemRepository).save(itemCaptor.capture());
        assertEquals("Capture idea later", itemCaptor.getValue().getTitle().value());
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("stuff created", PersistenceChangeType.CREATE_ITEM);
    }

    @Test
    void convertStuffToNextActionCreatesNextActionMetadata() {
        UUID stuffId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        Item stuff = new Item(new Title("Call Ana"), null);
        Context context = new Context("phone");

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF)).thenReturn(Optional.of(stuff));
        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(context));

        inboxService.convertStuffToNextAction(stuffId, convertRequest(contextId));

        verify(itemRepository).save(stuff);
        assertEquals(new BigDecimal("4.5"), stuff.getNextAction().getEnergy());
        assertEquals(Duration.ofMinutes(90), stuff.getNextAction().getEstimatedTime());
        assertEquals(LocalDate.parse("2028-02-29"), stuff.getNextAction().getDeadline());
        assertEquals(context, stuff.getNextAction().getContexts().iterator().next());
        verify(persistenceGitSyncService).requestSync("stuff converted to next action", PersistenceChangeType.UPDATE_ITEM);
    }

    @Test
    void convertStuffToNextActionAllowsAnywhereContext() {
        UUID stuffId = UUID.randomUUID();
        Item stuff = new Item(new Title("Call Ana"), null);

        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF)).thenReturn(Optional.of(stuff));

        inboxService.convertStuffToNextAction(stuffId, convertRequest(List.of()));

        verify(itemRepository).save(stuff);
        assertEquals(Set.of(), stuff.getNextAction().getContexts());
        verify(contextRepository, never()).findAllByIdInAndDeletedAtIsNull(any());
    }

    @Test
    void convertStuffToNextActionThrowsWhenContextDoesNotExist() {
        UUID stuffId = UUID.randomUUID();
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF))
            .thenReturn(Optional.of(new Item(new Title("Call Ana"), null)));
        when(contextRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> inboxService.convertStuffToNextAction(stuffId, convertRequest(List.of(UUID.randomUUID()))));

        assertEquals("context not found", exception.getMessage());
        verify(itemRepository, never()).save(any(Item.class));
    }

    @Test
    void convertStuffToCalendarQueuesGoogleCalendarEvent() {
        UUID stuffId = UUID.randomUUID();
        Item stuff = new Item(new Title("Pay rent"), null);
        when(itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF)).thenReturn(Optional.of(stuff));

        inboxService.convertStuffToCalendar(stuffId, new ConvertStuffToCalendarRequestDto("2026-05-21", "09:30"));

        verify(itemRepository).save(stuff);
        verify(googleCalendarEventQueueService).requestUpsert(stuffId);
    }

    private ConvertStuffToNextActionRequestDto convertRequest(UUID contextId) {
        return convertRequest(List.of(contextId));
    }

    private ConvertStuffToNextActionRequestDto convertRequest(List<UUID> contextIds) {
        return new ConvertStuffToNextActionRequestDto(
            new BigDecimal("4.5"),
            new ItemTimeRequestDto(1L, 30),
            contextIds,
            LocalDate.parse("2028-02-29"));
    }

    private StuffResponseDto stuffResponse(String title) {
        return new StuffResponseDto(UUID.randomUUID(), title, ItemBody.empty(), "STUFF", Instant.now());
    }
}
