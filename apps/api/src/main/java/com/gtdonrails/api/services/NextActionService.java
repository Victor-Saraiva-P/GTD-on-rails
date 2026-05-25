package com.gtdonrails.api.services;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.dtos.nextaction.PatchNextActionRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.NextActionMapper;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NextActionService {

    private final NextActionRepository nextActionRepository;
    private final ContextRepository contextRepository;
    private final NextActionMapper nextActionMapper;
    private final Clock clock;

    public NextActionService(
        NextActionRepository nextActionRepository,
        ContextRepository contextRepository,
        NextActionMapper nextActionMapper,
        Clock clock
    ) {
        this.nextActionRepository = nextActionRepository;
        this.contextRepository = contextRepository;
        this.nextActionMapper = nextActionMapper;
        this.clock = clock;
    }

    @Transactional
    public NextActionResponseDto patchNextAction(UUID id, PatchNextActionRequestDto request) {
        NextAction nextAction = findNextAction(id);

        if (request.energy() != null) {
            nextAction.setEnergy(request.energy());
        }

        if (request.estimatedTime() != null) {
            nextAction.setEstimatedTime(request.estimatedTime().toDuration());
        }

        if (Boolean.TRUE.equals(request.clearDeadline())) {
            nextAction.setDeadline(null);
        } else if (request.deadline() != null) {
            nextAction.setDeadline(request.deadline());
        }

        if (request.contextIds() != null) {
            Set<Context> contexts = findContextsOrThrow(request.contextIds());
            nextAction.replaceContexts(contexts);
        }

        return nextActionMapper.toResponse(nextActionRepository.save(nextAction));
    }

    @Transactional
    public NextActionResponseDto markOnGoing(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.markOnGoing(clock);
        return nextActionMapper.toResponse(nextActionRepository.save(nextAction));
    }

    @Transactional
    public NextActionResponseDto markDone(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.markDone(clock);
        return nextActionMapper.toResponse(nextActionRepository.save(nextAction));
    }

    @Transactional
    public NextActionResponseDto resetNextActionStatus(UUID id) {
        NextAction nextAction = findNextAction(id);
        nextAction.resetStatus();
        return nextActionMapper.toResponse(nextActionRepository.save(nextAction));
    }

    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOnGoingNextActions() {
        return nextActionRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(NextActionStatus.ONGOING)
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByEnergy(UUID contextId) {
        List<NextAction> nextActions = contextId == null
            ? nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus.NEXT_ACTION)
            : nextActionRepository.findRunnableInContextOrderByEnergyDesc(NextActionStatus.NEXT_ACTION, contextId);

        return nextActions
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByTime(UUID contextId) {
        List<NextAction> nextActions = contextId == null
            ? nextActionRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION)
            : nextActionRepository.findRunnableInContextOrderByEstimatedTimeDesc(NextActionStatus.NEXT_ACTION, contextId);

        return nextActions
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getOrderedByPriority(
        UUID contextId,
        Integer currentTimeMinutes,
        BigDecimal currentEnergy
    ) {
        NextActionPriorityScore score = new NextActionPriorityScore(
            java.time.LocalDate.now(clock),
            currentTimeMinutes,
            currentEnergy);
        return unorderedRunnableNextActions(contextId)
            .stream()
            .sorted(Comparator.comparingDouble(score::calculate).reversed())
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<NextActionResponseDto> getDeletedNextActions() {
        return nextActionRepository
            .findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc()
            .stream()
            .map(nextActionMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public Page<NextActionResponseDto> getDoneNextActions(Pageable pageable) {
        return nextActionRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(NextActionStatus.DONE, pageable)
            .map(nextActionMapper::toResponse);
    }

    private NextAction findNextAction(UUID id) {
        return nextActionRepository.findById(id).orElseThrow(() -> new ItemNotFoundException("NextAction " + id + " not found"));
    }

    private List<NextAction> unorderedRunnableNextActions(UUID contextId) {
        if (contextId == null) {
            return nextActionRepository.findAllByStatusAndItem_DeletedAtIsNull(NextActionStatus.NEXT_ACTION);
        }
        return nextActionRepository.findRunnableInContext(NextActionStatus.NEXT_ACTION, contextId);
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
