package com.gtdonrails.api.services;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.recurring.ConvertStuffToRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.dtos.recurring.RecurringCalendarTemplateResponseDto;
import com.gtdonrails.api.dtos.recurring.UpdateRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.RecurringCalendarTemplate;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.RecurringCalendarTemplateMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.RecurringCalendarTemplateRepository;
import com.gtdonrails.api.types.Title;
import com.gtdonrails.api.types.ItemBody;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecurringCalendarTemplateService {

    private final RecurringCalendarTemplateRepository templateRepository;
    private final CalendarRepository calendarRepository;
    private final ItemRepository itemRepository;
    private final RecurringCalendarTemplateMapper templateMapper;
    private final RecurringCalendarOccurrencePlanner occurrencePlanner;
    private final ItemBodyNormalizer itemBodyNormalizer;
    private final ItemAssetService itemAssetService;
    private final ItemTextNormalizer itemTextNormalizer;
    private final Clock clock;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;

    public RecurringCalendarTemplateService(
        RecurringCalendarTemplateRepository templateRepository,
        CalendarRepository calendarRepository,
        ItemRepository itemRepository,
        RecurringCalendarTemplateMapper templateMapper,
        RecurringCalendarOccurrencePlanner occurrencePlanner,
        ItemBodyNormalizer itemBodyNormalizer,
        ItemAssetService itemAssetService,
        ItemTextNormalizer itemTextNormalizer,
        Clock clock,
        PersistenceGitSyncService persistenceGitSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.templateRepository = templateRepository;
        this.calendarRepository = calendarRepository;
        this.itemRepository = itemRepository;
        this.templateMapper = templateMapper;
        this.occurrencePlanner = occurrencePlanner;
        this.itemBodyNormalizer = itemBodyNormalizer;
        this.itemAssetService = itemAssetService;
        this.itemTextNormalizer = itemTextNormalizer;
        this.clock = clock;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Converts active inbox stuff into a Recurring Calendar Template.
     *
     * <p>Example: {@code service.convertStuffToRecurringCalendarTemplate(stuffId, request)}.</p>
     */
    @Transactional
    public RecurringCalendarTemplateResponseDto convertStuffToRecurringCalendarTemplate(
        UUID stuffId,
        ConvertStuffToRecurringCalendarTemplateRequestDto request
    ) {
        Item stuff = findActiveStuff(stuffId);
        RecurringCalendarTemplate template = convertStuff(stuff, request);
        Item savedStuff = itemRepository.saveAndFlush(stuff);
        template = savedStuff.getRecurringCalendarTemplate();
        refreshTemplateHorizon(template);
        requestPersistenceSyncAfterCommit("stuff converted to recurring calendar template");
        return templateMapper.toResponse(template);
    }

    /**
     * Refreshes one template's rolling occurrence horizon.
     *
     * <p>Example: {@code service.refreshTemplateHorizon(templateId)}.</p>
     */
    @Transactional
    public void refreshTemplateHorizon(UUID templateId) {
        refreshTemplateHorizon(findTemplate(templateId));
    }

    /**
     * Updates a Recurring Calendar Template and propagates future defaults.
     *
     * <p>Example: {@code service.updateTemplate(templateId, request)}.</p>
     */
    @Transactional
    public RecurringCalendarTemplateResponseDto updateTemplate(
        UUID templateId,
        UpdateRecurringCalendarTemplateRequestDto request
    ) {
        RecurringCalendarTemplate template = findTemplate(templateId);
        applyTemplateUpdate(template, request);
        templateRepository.saveAndFlush(template);
        propagateTemplateToOccurrences(template);
        refreshTemplateHorizon(template);
        requestPersistenceSyncAfterCommit("recurring calendar template updated");
        return templateMapper.toResponse(template);
    }

    /**
     * Updates template body and propagates it to future default occurrences.
     *
     * <p>Example: {@code service.patchTemplateBody(templateId, request)}.</p>
     */
    @Transactional
    public RecurringCalendarTemplateResponseDto patchTemplateBody(
        UUID templateId,
        PatchItemBodyRequestDto request
    ) {
        RecurringCalendarTemplate template = findTemplate(templateId);
        ItemBody body = itemBodyNormalizer.normalizeBody(request.body());
        itemAssetService.reconcileBodyAssetReferences(templateId, body);
        template.getItem().setBody(body);
        templateRepository.saveAndFlush(template);
        propagateTemplateToOccurrences(template);
        requestPersistenceSyncAfterCommit("recurring calendar template body updated");
        return templateMapper.toResponse(template);
    }

    /**
     * Soft-deletes a template and removes future default occurrences.
     *
     * <p>Example: {@code service.deleteTemplate(templateId)}.</p>
     */
    @Transactional
    public void deleteTemplate(UUID templateId) {
        RecurringCalendarTemplate template = findTemplate(templateId);
        deleteFutureDefaultOccurrences(template);
        template.getItem().softDelete();
        templateRepository.save(template);
        requestPersistenceSyncAfterCommit("recurring calendar template deleted");
    }

    /**
     * Restores a soft-deleted template and regenerates future occurrences.
     *
     * <p>Example: {@code service.restoreTemplate(templateId)}.</p>
     */
    @Transactional
    public RecurringCalendarTemplateResponseDto restoreTemplate(UUID templateId) {
        RecurringCalendarTemplate template = findTemplate(templateId);
        template.getItem().restore();
        templateRepository.saveAndFlush(template);
        refreshTemplateHorizon(template);
        requestPersistenceSyncAfterCommit("recurring calendar template restored");
        return templateMapper.toResponse(template);
    }

    /**
     * Lists active Recurring Calendar Templates.
     *
     * <p>Example: {@code service.listActiveTemplates()}.</p>
     */
    @Transactional(readOnly = true)
    public List<RecurringCalendarTemplateResponseDto> listActiveTemplates() {
        return templateRepository.findAllByItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc()
            .stream()
            .map(templateMapper::toResponse)
            .toList();
    }

    /**
     * Refreshes horizons for all active Recurring Calendar Templates.
     *
     * <p>Example: {@code service.refreshActiveTemplateHorizons()}.</p>
     */
    @Transactional
    public void refreshActiveTemplateHorizons() {
        templateRepository.findAllByItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc()
            .forEach(this::refreshTemplateHorizon);
    }

    private RecurringCalendarTemplate convertStuff(
        Item stuff,
        ConvertStuffToRecurringCalendarTemplateRequestDto request
    ) {
        return stuff.convertToRecurringCalendarTemplate(
            request.toStartDate(), request.toScheduledTime(), request.intervalValue(),
            request.toRecurrenceUnit(), request.toWeeklyWeekdays(), request.toEndDate());
    }

    private void applyTemplateUpdate(
        RecurringCalendarTemplate template,
        UpdateRecurringCalendarTemplateRequestDto request
    ) {
        template.getItem().setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
        template.updateRecurrence(
            request.toStartDate(), request.toScheduledTime(), request.intervalValue(),
            request.toRecurrenceUnit(), request.toWeeklyWeekdays(), request.toEndDate());
    }

    private void propagateTemplateToOccurrences(RecurringCalendarTemplate template) {
        calendarRepository.findAllByRecurringCalendarTemplate_ItemId(template.getItemId())
            .stream()
            .filter(this::canPropagateTemplateToOccurrence)
            .forEach(calendar -> applyTemplateToOccurrence(template, calendar));
    }

    private boolean canPropagateTemplateToOccurrence(Calendar calendar) {
        if (calendar.isPersonalizedOccurrence()) return false;
        if (calendar.getStatus() != CalendarStatus.CALENDAR) return false;
        return !calendar.getOriginalScheduledDate().isBefore(LocalDate.now(clock));
    }

    private void applyTemplateToOccurrence(RecurringCalendarTemplate template, Calendar calendar) {
        calendar.getItem().setTitle(template.getItem().getTitle());
        calendar.getItem().setBody(template.getItem().getBody());
        calendar.setScheduledTime(template.getScheduledTime());
        calendar.markRecurringOccurrence(template, calendar.getOriginalScheduledDate(), template.getScheduledTime());
        requestGoogleCalendarEventSyncAfterCommit(calendar.getItemId());
    }

    private void deleteFutureDefaultOccurrences(RecurringCalendarTemplate template) {
        calendarRepository.findAllByRecurringCalendarTemplate_ItemId(template.getItemId())
            .stream()
            .filter(this::canHardDeleteFutureDefaultOccurrence)
            .forEach(this::hardDeleteOccurrence);
    }

    private boolean canHardDeleteFutureDefaultOccurrence(Calendar calendar) {
        if (calendar.isPersonalizedOccurrence()) return false;
        if (calendar.getStatus() != CalendarStatus.CALENDAR) return false;
        return !calendar.getOriginalScheduledDate().isBefore(LocalDate.now(clock));
    }

    private void hardDeleteOccurrence(Calendar calendar) {
        itemRepository.delete(calendar.getItem());
        requestGoogleCalendarEventDeleteAfterCommit(calendar.getItemId());
    }

    private void refreshTemplateHorizon(RecurringCalendarTemplate template) {
        List<Calendar> existing = calendarRepository.findAllByRecurringCalendarTemplate_ItemId(template.getItemId());
        occurrencePlanner.occurrenceDates(template, LocalDate.now(clock)).stream()
            .filter(date -> occurrenceIsMissing(existing, template, date))
            .forEach(date -> saveOccurrence(template, date));
    }

    private boolean occurrenceIsMissing(
        List<Calendar> existing,
        RecurringCalendarTemplate template,
        LocalDate date
    ) {
        return existing.stream()
            .noneMatch(calendar -> calendar.matchesRecurringOccurrence(template, date, template.getScheduledTime()));
    }

    private void saveOccurrence(RecurringCalendarTemplate template, LocalDate date) {
        Item occurrenceItem = new Item(template.getItem().getTitle(), null);
        occurrenceItem.setBody(template.getItem().getBody());
        Calendar occurrence = occurrenceItem.convertToCalendar(date, template.getScheduledTime());
        occurrence.markRecurringOccurrence(template, date, template.getScheduledTime());
        Item savedItem = itemRepository.save(occurrenceItem);
        requestGoogleCalendarEventSyncAfterCommit(savedItem.getId());
    }

    private Item findActiveStuff(UUID stuffId) {
        return itemRepository.findByIdAndStatusAndDeletedAtIsNull(stuffId, ItemStatus.STUFF)
            .orElseThrow(() -> new ItemNotFoundException("stuff not found"));
    }

    private RecurringCalendarTemplate findTemplate(UUID templateId) {
        return templateRepository.findById(templateId)
            .orElseThrow(() -> new ItemNotFoundException("recurring calendar template " + templateId + " not found"));
    }

    private void requestPersistenceSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> persistenceGitSyncService.requestSync(reason, PersistenceChangeType.UPDATE_ITEM));
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void requestGoogleCalendarEventDeleteAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestDelete(itemId));
    }
}
