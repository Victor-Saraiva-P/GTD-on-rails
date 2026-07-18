package com.gtdonrails.api.services;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.dtos.calendar.PatchCalendarRequestDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.CalendarMapper;
import com.gtdonrails.api.repositories.CalendarRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CalendarService {

    private final CalendarRepository calendarRepository;
    private final CalendarMapper calendarMapper;
    private final Clock clock;
    private final FileSyncService fileSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;

    public CalendarService(
        CalendarRepository calendarRepository,
        CalendarMapper calendarMapper,
        Clock clock,
        FileSyncService fileSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.calendarRepository = calendarRepository;
        this.calendarMapper = calendarMapper;
        this.clock = clock;
        this.fileSyncService = fileSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Lists active calendar items due today or earlier.
     *
     * <p>Example: {@code calendarService.getTodayCalendars()}.</p>
     */
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getTodayCalendars() {
        LocalDate today = LocalDate.now(clock);
        return mapCalendars(calendarRepository
            .findAllByStatusAndScheduledDateLessThanEqualAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
                CalendarStatus.CALENDAR,
                today));
    }

    /**
     * Lists calendar items completed today.
     *
     * <p>Example: {@code calendarService.getDoneTodayCalendars()}.</p>
     */
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getDoneTodayCalendars() {
        return mapCalendars(calendarRepository
            .findAllByStatusAndSchedule_DateEndAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(
                CalendarStatus.DONE,
                LocalDate.now(clock)));
    }

    /**
     * Lists non-deleted calendars within a seven-day local date range.
     *
     * <p>Example: {@code calendarService.getWeekCalendars(start)}.</p>
     */
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getWeekCalendars(LocalDate start) {
        return mapCalendars(calendarRepository
            .findAllByScheduledDateBetweenAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
                start,
                start.plusDays(6)));
    }

    /**
     * Lists completed calendar items.
     *
     * <p>Example: {@code calendarService.getDoneCalendars()}.</p>
     */
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
    @Transactional(readOnly = true)
    public List<CalendarResponseDto> getDeletedCalendars() {
        return mapCalendars(calendarRepository.findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc());
    }

    /**
     * Lists ongoing calendar items.
     *
     * <p>Example: {@code calendarService.getOnGoingCalendars()}.</p>
     */
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
        requestDataSyncAfterCommit("calendar updated");
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
        return saveWithSync(calendar, "calendar marked ongoing");
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
        return saveWithSync(calendar, "calendar marked done");
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
        return saveWithSync(calendar, "calendar status restored");
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
        return saveWithSync(calendar, "calendar recovered");
    }

    private void applyPatch(Calendar calendar, PatchCalendarRequestDto request) {
        if (request.hasScheduledDate()) {
            calendar.setScheduledDate(request.toScheduledDate());
        }
        if (request.hasScheduledTime()) {
            calendar.setScheduledTime(request.toScheduledTime());
        }
    }

    private CalendarResponseDto saveWithSync(Calendar calendar, String reason) {
        Calendar savedCalendar = calendarRepository.save(calendar);
        CalendarResponseDto response = calendarMapper.toResponse(savedCalendar);
        requestGoogleCalendarEventSyncAfterCommit(savedCalendar.getItemId());
        requestDataSyncAfterCommit(reason);
        return response;
    }

    private Calendar findCalendar(UUID id) {
        return calendarRepository.findById(id)
            .orElseThrow(() -> new ItemNotFoundException("calendar " + id + " not found"));
    }

    private List<CalendarResponseDto> mapCalendars(List<Calendar> calendars) {
        return calendars.stream().map(calendarMapper::toResponse).toList();
    }

    private void requestDataSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> fileSyncService.requestSync(reason));
    }

    private void requestGoogleCalendarEventSyncAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }
}
