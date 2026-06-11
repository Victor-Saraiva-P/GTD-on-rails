package com.gtdonrails.api.services;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.dtos.nextaction.PatchNextActionRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.mappers.NextActionMapper;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.services.AssetStorageService;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NextActionServiceTests {

    @Mock
    private NextActionRepository nextActionRepository;

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private ContextIconAssetRepository contextIconAssetRepository;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    private NextActionMapper nextActionMapper;
    private Clock clock;
    private NextActionService nextActionService;

    private Item item;
    private Context context;
    private NextAction nextAction;
    private UUID nextActionId;
    private UUID contextId;

    @BeforeEach
    void setUp() {
        nextActionMapper = new NextActionMapper(new ContextMapper(assetStorageService, contextIconAssetRepository));
        clock = Clock.fixed(Instant.parse("2024-01-01T10:00:00Z"), ZoneId.of("UTC"));
        nextActionService = new NextActionService(
            nextActionRepository,
            contextRepository,
            nextActionMapper,
            googleCalendarEventQueueService,
            new AfterCommitExecutor(),
            clock);

        nextActionId = UUID.randomUUID();
        contextId = UUID.randomUUID();

        item = new Item(new Title("Test Item"), null);
        org.springframework.test.util.ReflectionTestUtils.setField(item, "id", nextActionId);
        context = new Context("Home");
        org.springframework.test.util.ReflectionTestUtils.setField(context, "id", contextId);

        nextAction = new NextAction(item, new BigDecimal("5.0"), Duration.ofMinutes(30), Set.of(context));
    }

    @Test
    void patchesNextActionSuccessfully() {
        PatchNextActionRequestDto request = new PatchNextActionRequestDto(new BigDecimal("7.0"), null, null, null, null);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.patchNextAction(nextActionId, request);

        assertThat(response.energy()).isEqualTo(new BigDecimal("7.0"));
        verify(nextActionRepository).save(nextAction);
        verify(googleCalendarEventQueueService, never()).requestUpsert(nextActionId);
    }

    @Test
    void patchingNextActionDeadlineQueuesGoogleCalendarEvent() {
        PatchNextActionRequestDto request = new PatchNextActionRequestDto(null, null, LocalDate.parse("2026-06-01"), null, null);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        nextActionService.patchNextAction(nextActionId, request);

        verify(googleCalendarEventQueueService).requestUpsert(nextActionId);
    }

    @Test
    void clearingNextActionDeadlineQueuesGoogleCalendarEvent() {
        PatchNextActionRequestDto request = new PatchNextActionRequestDto(null, null, null, true, null);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        nextActionService.patchNextAction(nextActionId, request);

        verify(googleCalendarEventQueueService).requestUpsert(nextActionId);
    }

    @Test
    void patchesNextActionToAnywhereContext() {
        PatchNextActionRequestDto request = new PatchNextActionRequestDto(null, null, null, null, List.of());
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.patchNextAction(nextActionId, request);

        assertThat(response.contexts()).isEmpty();
        verify(contextRepository, never()).findAllById(any());
        verify(nextActionRepository).save(nextAction);
    }

    @Test
    void throwsItemNotFoundWhenPatchingMissingNextAction() {
        PatchNextActionRequestDto request = new PatchNextActionRequestDto(new BigDecimal("7.0"), null, null, null, null);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> nextActionService.patchNextAction(nextActionId, request))
            .isInstanceOf(ItemNotFoundException.class);
    }

    @Test
    void marksOnGoingSuccessfully() {
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.markOnGoing(nextActionId);

        assertThat(response.status()).isEqualTo(NextActionStatus.ONGOING.name());
        verify(nextActionRepository).save(nextAction);
        verify(googleCalendarEventQueueService).requestUpsert(nextActionId);
    }

    @Test
    void marksDoneSuccessfully() {
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.markDone(nextActionId);

        assertThat(response.status()).isEqualTo(NextActionStatus.DONE.name());
        verify(nextActionRepository).save(nextAction);
        verify(googleCalendarEventQueueService).requestUpsert(nextActionId);
    }

    @Test
    void restoresDoneNextActionSuccessfully() {
        nextAction.markDone(clock);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.resetNextActionStatus(nextActionId);

        assertThat(response.status()).isEqualTo(NextActionStatus.NEXT_ACTION.name());
        verify(nextActionRepository).save(nextAction);
        verify(googleCalendarEventQueueService).requestUpsert(nextActionId);
    }

    @Test
    void restoresOnGoingNextActionSuccessfully() {
        nextAction.markOnGoing(clock);
        when(nextActionRepository.findById(nextActionId)).thenReturn(Optional.of(nextAction));
        when(nextActionRepository.save(any(NextAction.class))).thenReturn(nextAction);

        NextActionResponseDto response = nextActionService.resetNextActionStatus(nextActionId);

        assertThat(response.status()).isEqualTo(NextActionStatus.NEXT_ACTION.name());
        verify(nextActionRepository).save(nextAction);
    }

    @Test
    void getsOrderedByEnergy() {
        when(nextActionRepository.findRunnableInContextsOrderByEnergyDesc(NextActionStatus.NEXT_ACTION, List.of(contextId)))
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getOrderedByEnergy(List.of(contextId));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().energy()).isEqualTo(new BigDecimal("5.0"));
    }

    @Test
    void getsAllOrderedByEnergyWhenContextIsMissing() {
        when(nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus.NEXT_ACTION))
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getOrderedByEnergy(List.of());

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().energy()).isEqualTo(new BigDecimal("5.0"));
    }

    @Test
    void getsOrderedByTime() {
        when(nextActionRepository.findRunnableInContextsOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION, List.of(contextId)))
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getOrderedByTime(List.of(contextId));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().estimatedTime()).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void getsAllOrderedByTimeWhenContextIsMissing() {
        when(nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION))
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getOrderedByTime(List.of());

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().estimatedTime()).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void getsOrderedByPriority() {
        NextAction later = nextActionWithDeadline("Later", "2024-01-20", 15, "1.0");
        NextAction dueSoon = nextActionWithDeadline("Soon", "2024-01-02", 60, "8.0");
        when(nextActionRepository.findAllByStatusAndItem_DeletedAtIsNull(NextActionStatus.NEXT_ACTION))
            .thenReturn(List.of(later, dueSoon));

        List<NextActionResponseDto> result = nextActionService.getOrderedByPriority(List.of(), 15, new BigDecimal("3.0"));

        assertThat(result.getFirst().title()).isEqualTo("Soon");
    }

    @Test
    void getsOnGoingNextActions() {
        nextAction.markOnGoing(clock);
        when(nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(NextActionStatus.ONGOING))
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getOnGoingNextActions();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().status()).isEqualTo(NextActionStatus.ONGOING.name());
    }

    @Test
    void getsDeletedNextActions() {
        item.softDelete();
        when(nextActionRepository.findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc())
            .thenReturn(List.of(nextAction));

        List<NextActionResponseDto> result = nextActionService.getDeletedNextActions();

        assertThat(result).hasSize(1);
    }

    @Test
    void getsDoneNextActions() {
        nextAction.markDone(clock);
        PageRequest pageable = PageRequest.of(0, 10);
        when(nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(NextActionStatus.DONE, pageable))
            .thenReturn(new PageImpl<>(List.of(nextAction)));

        Page<NextActionResponseDto> result = nextActionService.getDoneNextActions(pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().getFirst().status()).isEqualTo(NextActionStatus.DONE.name());
    }

    private NextAction nextActionWithDeadline(String title, String deadline, int minutes, String energy) {
        Item nextItem = new Item(new Title(title), null);
        NextAction action = new NextAction(nextItem, new BigDecimal(energy), Duration.ofMinutes(minutes), Set.of());
        action.setDeadline(LocalDate.parse(deadline));
        return action;
    }
}
