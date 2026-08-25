package com.gtdonrails.api.services;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.dtos.nextaction.PatchNextActionRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.NextActionMapper;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NextActionService {

    private final NextActionRepository nextActionRepository;
    private final ContextRepository contextRepository;
    private final NextActionMapper nextActionMapper;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final CacheInvalidationService cacheInvalidationService;
    private final Clock clock;

    public NextActionService(
        NextActionRepository nextActionRepository,
        ContextRepository contextRepository,
        NextActionMapper nextActionMapper,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor,
        CacheInvalidationService cacheInvalidationService,
        Clock clock
    ) {
        this.nextActionRepository = nextActionRepository;
        this.contextRepository = contextRepository;
        this.nextActionMapper = nextActionMapper;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.cacheInvalidationService = cacheInvalidationService;
        this.clock = clock;
    }

    @Transactional
    public NextActionResponseDto patchNextAction(UUID id, PatchNextActionRequestDto request) {
        NextAction nextAction = findNextAction(id);
        applyNextActionPatch(nextAction, request);
        if (changesDeadline(request)) requestGoogleCalendarEventSyncAfterCommit(id);
        NextActionResponseDto response = nextActionMapper.toResponse(nextActionRepository.save(nextAction));
        evictCachesAfterCommit();
        return response;
    }

    private void applyNextActionPatch(NextAction nextAction, PatchNextActionRequestDto request) {
        if (request.energy() != null) nextAction.setEnergy(request.energy());
        if (request.estimatedTime() != null) nextAction.setEstimatedTime(request.estimatedTime().toDuration());
        applyDeadlinePatch(nextAction, request);
        if (request.contextIds() != null) nextAction.replaceContexts(findContextsOrThrow(request.contextIds()));
    }

    private void applyDeadlinePatch(NextAction nextAction, PatchNextActionRequestDto request) {
        if (Boolean.TRUE.equals(request.clearDeadline())) {
            nextAction.setDeadline(null);
            return;
        }
        if (request.deadline() != null) nextAction.setDeadline(request.deadline());
    }

    private boolean changesDeadline(PatchNextActionRequestDto request) {
        return Boolean.TRUE.equals(request.clearDeadline()) || request.deadline() != null;
    }

    @Transactional
    public NextActionResponseDto markOnGoing(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.markOnGoing(clock);
        requestGoogleCalendarEventSyncAfterCommit(id);
        NextActionResponseDto response = nextActionMapper.toResponse(nextActionRepository.save(nextAction));
        evictCachesAfterCommit();
        return response;
    }

    @Transactional
    public NextActionResponseDto markDone(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.markDone(clock);
        requestGoogleCalendarEventSyncAfterCommit(id);
        NextActionResponseDto response = nextActionMapper.toResponse(nextActionRepository.save(nextAction));
        evictCachesAfterCommit();
        return response;
    }

    @Transactional
    public NextActionResponseDto resetNextActionStatus(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.resetStatus();
        requestGoogleCalendarEventSyncAfterCommit(id);
        NextActionResponseDto response = nextActionMapper.toResponse(nextActionRepository.save(nextAction));
        evictCachesAfterCommit();
        return response;
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void evictCachesAfterCommit() {
        afterCommitExecutor.run(cacheInvalidationService::evictItemMutation);
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'ongoing'")
    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOnGoingNextActions() {
        return nextActionRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(NextActionStatus.ONGOING)
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'energy:' + #contextIds")
    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByEnergy(List<UUID> contextIds) {
        List<NextAction> nextActions = noContextFilter(contextIds)
            ? nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus.NEXT_ACTION)
            : nextActionRepository.findRunnableInContextsOrderByEnergyDesc(NextActionStatus.NEXT_ACTION, contextIds);

        return nextActions
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'time:' + #contextIds")
    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByTime(List<UUID> contextIds) {
        List<NextAction> nextActions = noContextFilter(contextIds)
            ? nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION)
            : nextActionRepository.findRunnableInContextsOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION, contextIds);

        return nextActions
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'priority:' + #contextIds + ':' + #currentTimeMinutes + ':' + #currentEnergy")
    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByPriority(
        List<UUID> contextIds,
        Integer currentTimeMinutes,
        BigDecimal currentEnergy
    ) {
        NextActionPriorityScore score = new NextActionPriorityScore(
            java.time.LocalDate.now(clock),
            currentTimeMinutes,
            currentEnergy);
        return unorderedRunnableNextActions(contextIds)
            .stream()
            .sorted(Comparator.comparingDouble(score::calculate).reversed())
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'deleted'")
    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getDeletedNextActions() {
        return nextActionRepository
            .findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc()
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Cacheable(value = CacheNames.NEXT_ACTIONS, key = "'done:' + #pageable.pageNumber + ':' + #pageable.pageSize")
    @Transactional(readOnly = true)
    public Page<NextActionResponseDto> getDoneNextActions(Pageable pageable) {
        return nextActionRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(NextActionStatus.DONE, pageable)
            .map(nextActionMapper::toResponse);
    }

    private NextAction findNextAction(UUID id) {
        return nextActionRepository.findById(id).orElseThrow(() -> new ItemNotFoundException("NextAction " + id + " not found"));
    }

    private List<NextAction> unorderedRunnableNextActions(List<UUID> contextIds) {
        if (noContextFilter(contextIds)) {
            return nextActionRepository.findAllByStatusAndItem_DeletedAtIsNull(NextActionStatus.NEXT_ACTION);
        }
        return nextActionRepository.findRunnableInContexts(NextActionStatus.NEXT_ACTION, contextIds);
    }

    private boolean noContextFilter(List<UUID> contextIds) {
        return contextIds == null || contextIds.isEmpty();
    }

    private Set<Context> findContextsOrThrow(List<UUID> contextIds) {
        if (contextIds.isEmpty()) {
            return Set.of();
        }

        Set<Context> contexts = new java.util.HashSet<>(contextRepository.findAllById(contextIds));
        if (contexts.size() != contextIds.size()) {
            throw new IllegalArgumentException("One or more contexts not found");
        }
        return contexts;
    }
}
