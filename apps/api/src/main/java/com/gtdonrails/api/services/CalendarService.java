package com.gtdonrails.api.services;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.calendar.CalendarEntryResponseDto;
import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.dtos.calendar.PatchCalendarRequestDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.CalendarEntrySourceKind;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.enums.CalendarTemporalState;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.CalendarEntryMapper;
import com.gtdonrails.api.mappers.CalendarMapper;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.ScheduleWindow;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CalendarService {

    private final CalendarRepository calendarRepository;
    private final NextActionRepository nextActionRepository;
    private final CalendarMapper calendarMapper;
    private final CalendarEntryMapper calendarEntryMapper;
    private final Clock clock;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final CacheInvalidationService cacheInvalidationService;

    public CalendarService(
        CalendarRepository calendarRepository,
        NextActionRepository nextActionRepository,
        CalendarMapper calendarMapper,
        CalendarEntryMapper calendarEntryMapper,
        Clock clock,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor,
        CacheInvalidationService cacheInvalidationService
    ) {
        this.calendarRepository = calendarRepository;
        this.nextActionRepository = nextActionRepository;
        this.calendarMapper = calendarMapper;
        this.calendarEntryMapper = calendarEntryMapper;
        this.clock = clock;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.cacheInvalidationService = cacheInvalidationService;
    }

    /**
     * Lists the aggregated Calendar Today read model for the client's local date.
     *
     * <p>Example: {@code calendarService.getTodayEntries(LocalDate.parse("2026-05-21"))}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'entries:today:' + #localDate")
    @Transactional(readOnly = true)
    public List<CalendarEntryResponseDto> getTodayEntries(LocalDate localDate) {
        List<CalendarEntryResponseDto> entries = new ArrayList<>();
        addTodayCalendars(entries, localDate);
        addTodayNextActions(entries, localDate);
        entries.sort(this::compareTodayEntries);
        return entries;
    }

    /**
     * Lists Calendar entries completed on the client's local date.
     *
     * <p>Example: {@code calendarService.getDoneTodayEntries(LocalDate.parse("2026-05-21"))}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'entries:done-today:' + #localDate")
    @Transactional(readOnly = true)
    public List<CalendarEntryResponseDto> getDoneTodayEntries(LocalDate localDate) {
        List<CompletedEntry> entries = new ArrayList<>(completedCalendarEntries(localDate));
        entries.addAll(completedNextActionEntries(localDate));
        entries.sort(Comparator.comparing(CompletedEntry::completedAt).reversed());
        return entries.stream().map(CompletedEntry::response).toList();
    }

    /**
     * Lists active Calendar entries within a seven-day range.
     *
     * <p>Example: {@code calendarService.getWeekEntries(LocalDate.parse("2026-05-18"))}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'entries:week:' + #start")
    @Transactional(readOnly = true)
    public List<CalendarEntryResponseDto> getWeekEntries(LocalDate start) {
        List<CalendarEntryResponseDto> entries = new ArrayList<>();
        addWeekCalendars(entries, start);
        addWeekNextActions(entries, start);
        entries.sort(this::compareWeekEntries);
        return entries;
    }

    /**
     * Lists completed calendar items.
     *
     * <p>Example: {@code calendarService.getDoneCalendars()}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'done'")
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getDoneCalendars() {
        return mapCalendars(calendarRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(CalendarStatus.DONE));
    }

    /**
     * Lists soft-deleted calendar items.
     *
     * <p>Example: {@code calendarService.getDeletedCalendars()}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'deleted'")
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getDeletedCalendars() {
        return mapCalendars(calendarRepository.findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc());
    }

    /**
     * Lists ongoing calendar items.
     *
     * <p>Example: {@code calendarService.getOnGoingCalendars()}.</p>
     */
    @Cacheable(value = CacheNames.CALENDAR, key = "'ongoing'")
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getOnGoingCalendars() {
        return mapCalendars(calendarRepository
            .findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(CalendarStatus.ONGOING));
    }

    /**
     * Updates calendar scheduling metadata.
     *
     * <p>Example: {@code calendarService.patchCalendar(calendarId, request)}.</p>
     */
    @Transactional
    public CalendarResponseDto patchCalendar(UUID id, PatchCalendarRequestDto request) {
        Calendar calendar = findCalendar(id);
        applyPatch(calendar, request);
        Calendar savedCalendar = calendarRepository.save(calendar);
        CalendarResponseDto response = calendarMapper.toResponse(savedCalendar);
        requestGoogleCalendarEventSyncAfterCommit(savedCalendar.getItemId());
        evictCachesAfterCommit();
        return response;
    }

    /**
     * Marks a calendar item as ongoing.
     *
     * <p>Example: {@code calendarService.markOnGoing(calendarId)}.</p>
     */
    @Transactional
    public CalendarResponseDto markOnGoing(UUID id) {
        Calendar calendar = findCalendar(id);
        calendar.markOnGoing(clock);
        return saveAndSyncCalendar(calendar);
    }

    /**
     * Marks a calendar item as done.
     *
     * <p>Example: {@code calendarService.markDone(calendarId)}.</p>
     */
    @Transactional
    public CalendarResponseDto markDone(UUID id) {
        Calendar calendar = findCalendar(id);
        calendar.markDone(clock);
        return saveAndSyncCalendar(calendar);
    }

    /**
     * Restores a done or ongoing calendar to the active calendar state.
     *
     * <p>Example: {@code calendarService.resetCalendarStatus(calendarId)}.</p>
     */
    @Transactional
    public CalendarResponseDto resetCalendarStatus(UUID id) {
        Calendar calendar = findCalendar(id);
        calendar.resetStatus();
        return saveAndSyncCalendar(calendar);
    }

    /**
     * Recovers a soft-deleted calendar without changing its calendar status.
     *
     * <p>Example: {@code calendarService.recoverCalendar(calendarId)}.</p>
     */
    @Transactional
    public CalendarResponseDto recoverCalendar(UUID id) {
        Calendar calendar = findCalendar(id);
        calendar.getItem().restore();
        return saveAndSyncCalendar(calendar);
    }

    private void addTodayCalendars(List<CalendarEntryResponseDto> entries, LocalDate localDate) {
        calendarRepository
            .findAllByStatusAndScheduledDateLessThanEqualAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
                CalendarStatus.CALENDAR, localDate)
            .forEach(calendar -> entries.add(calendarEntryMapper.fromCalendar(calendar, calendarTodayState(calendar, localDate))));
    }

    private void addTodayNextActions(List<CalendarEntryResponseDto> entries, LocalDate localDate) {
        List<NextAction> actions = nextActionRepository.findAllByStatusAndDeadlineLessThanEqualAndItem_DeletedAtIsNull(
            NextActionStatus.NEXT_ACTION, localDate);
        sortedNextActions(actions).forEach(action -> entries.add(
            calendarEntryMapper.fromNextAction(action, nextActionTodayState(action, localDate))));
    }

    private CalendarTemporalState calendarTodayState(Calendar calendar, LocalDate localDate) {
        if (calendar.getScheduledDate().isBefore(localDate)) return CalendarTemporalState.OVERDUE;
        if (calendar.getScheduledTime() != null) return CalendarTemporalState.SCHEDULED_TODAY;
        return CalendarTemporalState.DUE_TODAY;
    }

    private CalendarTemporalState nextActionTodayState(NextAction nextAction, LocalDate localDate) {
        return nextAction.getDeadline().isBefore(localDate)
            ? CalendarTemporalState.OVERDUE
            : CalendarTemporalState.DUE_TODAY;
    }

    private int compareTodayEntries(CalendarEntryResponseDto left, CalendarEntryResponseDto right) {
        int groupComparison = Integer.compare(todayGroup(left), todayGroup(right));
        if (groupComparison != 0) return groupComparison;
        int dateComparison = entryDate(left).compareTo(entryDate(right));
        if (dateComparison != 0) return dateComparison;
        return compareWithinDate(left, right);
    }

    private int todayGroup(CalendarEntryResponseDto entry) {
        if (entry.temporalState() == CalendarTemporalState.SCHEDULED_TODAY) return 0;
        if (entry.temporalState() == CalendarTemporalState.OVERDUE) return 1;
        return 2;
    }

    private void addWeekCalendars(List<CalendarEntryResponseDto> entries, LocalDate start) {
        calendarRepository
            .findAllByStatusAndScheduledDateBetweenAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
                CalendarStatus.CALENDAR, start, start.plusDays(6))
            .forEach(calendar -> entries.add(calendarEntryMapper.fromCalendar(calendar, CalendarTemporalState.WEEK)));
    }

    private void addWeekNextActions(List<CalendarEntryResponseDto> entries, LocalDate start) {
        List<NextAction> actions = nextActionRepository.findAllByStatusAndDeadlineBetweenAndItem_DeletedAtIsNull(
            NextActionStatus.NEXT_ACTION, start, start.plusDays(6));
        sortedNextActions(actions).forEach(action -> entries.add(
            calendarEntryMapper.fromNextAction(action, CalendarTemporalState.WEEK)));
    }

    private int compareWeekEntries(CalendarEntryResponseDto left, CalendarEntryResponseDto right) {
        int dateComparison = entryDate(left).compareTo(entryDate(right));
        return dateComparison != 0 ? dateComparison : compareWithinDate(left, right);
    }

    private int compareWithinDate(CalendarEntryResponseDto left, CalendarEntryResponseDto right) {
        int rankComparison = Integer.compare(withinDateRank(left), withinDateRank(right));
        if (rankComparison != 0) return rankComparison;
        if (left.scheduledTime() != null && right.scheduledTime() != null) {
            return left.scheduledTime().compareTo(right.scheduledTime());
        }
        return 0;
    }

    private int withinDateRank(CalendarEntryResponseDto entry) {
        if (entry.sourceKind() != CalendarEntrySourceKind.CALENDAR) return 2;
        return entry.scheduledTime() == null ? 1 : 0;
    }

    private LocalDate entryDate(CalendarEntryResponseDto entry) {
        return entry.scheduledDate() != null ? entry.scheduledDate() : entry.deadline();
    }

    private List<NextAction> sortedNextActions(List<NextAction> actions) {
        Comparator<NextAction> comparator = Comparator
            .comparing(NextAction::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(action -> action.getItemId().toString());
        return actions.stream().sorted(comparator).toList();
    }

    private List<CompletedEntry> completedCalendarEntries(LocalDate localDate) {
        return calendarRepository
            .findAllByStatusAndSchedule_DateEndAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(
                CalendarStatus.DONE, localDate)
            .stream()
            .map(calendar -> new CompletedEntry(completedAt(calendar.getSchedule(), calendar.getUpdatedAt()),
                calendarEntryMapper.fromCalendar(calendar, CalendarTemporalState.DONE_TODAY)))
            .toList();
    }

    private List<CompletedEntry> completedNextActionEntries(LocalDate localDate) {
        return nextActionRepository
            .findAllByStatusAndSchedule_DateEndAndItem_DeletedAtIsNull(NextActionStatus.DONE, localDate)
            .stream()
            .filter(action -> action.getDeadline() != null && !action.getDeadline().isAfter(localDate))
            .map(action -> new CompletedEntry(completedAt(action.getSchedule(), action.getUpdatedAt()),
                calendarEntryMapper.fromNextAction(action, CalendarTemporalState.DONE_TODAY)))
            .toList();
    }

    private Instant completedAt(ScheduleWindow schedule, Instant updatedAt) {
        if (schedule != null && schedule.getDateEnd() != null && schedule.getTimeEnd() != null) {
            return schedule.getDateEnd().atTime(schedule.getTimeEnd()).atZone(clock.getZone()).toInstant();
        }
        return updatedAt == null ? Instant.EPOCH : updatedAt;
    }

    private void applyPatch(Calendar calendar, PatchCalendarRequestDto request) {
        if (request.hasScheduledDate()) {
            calendar.setScheduledDate(request.toScheduledDate());
        }
        if (request.hasScheduledTime()) {
            calendar.setScheduledTime(request.toScheduledTime());
        }
    }

    private CalendarResponseDto saveAndSyncCalendar(Calendar calendar) {
        Calendar savedCalendar = calendarRepository.save(calendar);
        CalendarResponseDto response = calendarMapper.toResponse(savedCalendar);
        requestGoogleCalendarEventSyncAfterCommit(savedCalendar.getItemId());
        evictCachesAfterCommit();
        return response;
    }

    private Calendar findCalendar(UUID id) {
        return calendarRepository.findById(id)
            .orElseThrow(() -> new ItemNotFoundException("calendar " + id + " not found"));
    }

    private List<CalendarResponseDto> mapCalendars(List<Calendar> calendars) {
        return calendars.stream().map(calendarMapper::toListResponse).toList();
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void evictCachesAfterCommit() {
        afterCommitExecutor.run(cacheInvalidationService::evictCalendarMutation);
    }

    private record CompletedEntry(Instant completedAt, CalendarEntryResponseDto response) {
    }
}
