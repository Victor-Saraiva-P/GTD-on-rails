package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.ConvertStuffToCalendarRequestDto;
import com.gtdonrails.api.dtos.inbox.ConvertStuffToNextActionRequestDto;
import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.inbox.StuffResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.StuffMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InboxService {

    private final ItemRepository itemRepository;
    private final ContextRepository contextRepository;
    private final StuffMapper stuffMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;

    public InboxService(
        ItemRepository itemRepository,
        ContextRepository contextRepository,
        StuffMapper stuffMapper,
        ItemTextNormalizer itemTextNormalizer,
        PersistenceGitSyncService persistenceGitSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.itemRepository = itemRepository;
        this.contextRepository = contextRepository;
        this.stuffMapper = stuffMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Lists active inbox items that are still in the GTD stuff state.
     *
     * <p>Example: {@code inboxService.listStuff()}.</p>
     */
    @Transactional(readOnly = true)
    public List<StuffResponseDto> listStuff() {
        return itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF)
            .stream()
            .map(stuffMapper::toResponse)
            .toList();
    }

    /**
     * Lists deleted inbox items that are still in the GTD stuff state.
     *
     * <p>Example: {@code inboxService.listDeletedStuff()}.</p>
     */
    @Transactional(readOnly = true)
    public List<StuffResponseDto> listDeletedStuff() {
        return itemRepository.findAllByStatusAndDeletedAtIsNotNullOrderByUpdatedAtDesc(ItemStatus.STUFF)
            .stream()
            .map(stuffMapper::toResponse)
            .toList();
    }

    /**
     * Returns one active inbox stuff item.
     *
     * <p>Example: {@code inboxService.getStuff(stuffId)}.</p>
     */
    @Transactional(readOnly = true)
    public StuffResponseDto getStuff(UUID id) {
        return stuffMapper.toResponse(findStuff(id));
    }

    /**
     * Creates a new inbox stuff item from captured title text.
     *
     * <p>Example: {@code inboxService.createStuff(request)}.</p>
     */
    @Transactional
    public StuffResponseDto createStuff(CreateStuffRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        Item item = new Item(title, null);
        item.markAsStuff();
        StuffResponseDto response = stuffMapper.toResponse(itemRepository.save(item));
        requestPersistenceSyncAfterCommit("stuff created", PersistenceChangeType.CREATE_ITEM);
        return response;
    }

    /**
     * Converts one inbox stuff item into a GTD next action.
     *
     * <p>Example: {@code inboxService.convertStuffToNextAction(stuffId, request)}.</p>
     */
    @Transactional
    public void convertStuffToNextAction(UUID id, ConvertStuffToNextActionRequestDto request) {
        Item item = findStuff(id);
        Set<Context> contexts = findContextsOrThrow(request.contextIds());
        NextAction nextAction = item.convertToNextAction(request.energy(), request.estimatedTime().toDuration(), contexts);
        nextAction.setDeadline(request.deadline());
        itemRepository.save(item);
        requestPersistenceSyncAfterCommit("stuff converted to next action", PersistenceChangeType.UPDATE_ITEM);
    }

    /**
     * Converts one inbox stuff item into a dated GTD calendar item.
     *
     * <p>Example: {@code inboxService.convertStuffToCalendar(stuffId, request)}.</p>
     */
    @Transactional
    public void convertStuffToCalendar(UUID id, ConvertStuffToCalendarRequestDto request) {
        Item item = findStuff(id);
        item.convertToCalendar(request.toScheduledDate(), request.toScheduledTime());
        itemRepository.save(item);
        requestGoogleCalendarEventSyncAfterCommit(id);
        requestPersistenceSyncAfterCommit("stuff converted to calendar", PersistenceChangeType.UPDATE_ITEM);
    }

    private Item findStuff(UUID id) {
        return itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.STUFF)
            .orElseThrow(() -> new ItemNotFoundException("stuff not found"));
    }

    private Set<Context> findContextsOrThrow(List<UUID> contextIds) {
        Set<UUID> uniqueContextIds = new HashSet<>(contextIds);
        if (uniqueContextIds.isEmpty()) {
            return Set.of();
        }

        List<Context> contexts = contextRepository.findAllByIdInAndDeletedAtIsNull(uniqueContextIds);

        if (contexts.size() != uniqueContextIds.size()) {
            throw new ContextNotFoundException("context not found");
        }
        return new HashSet<>(contexts);
    }

    private void requestPersistenceSyncAfterCommit(String reason, PersistenceChangeType changeType) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, changeType));
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }
}
