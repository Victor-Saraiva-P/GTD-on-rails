package com.gtdonrails.api.services;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.ScheduleWindow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoogleCalendarEventSyncService {

    private static final String CALENDAR_NAME = "Calendar";
    private static final String NEXT_ACTION_NAME = "Next Action";
    private static final String ONGOING_NAME = "On Going";
    private static final String DONE_NAME = "Done";

    private final GoogleCalendarService googleCalendarService;
    private final CalendarRepository calendarRepository;
    private final NextActionRepository nextActionRepository;
    private final GoogleCalendarRepository googleCalendarRepository;
    private final GoogleCalendarEventGateway eventGateway;

    /**
     * Loads the latest active GTD calendar state and mirrors it into Google.
     *
     * <p>Example: {@code syncService.syncCalendarEvent(itemId)}.</p>
     */
    public void syncCalendarEvent(UUID itemId) {
        Optional<Calendar> calendar = calendarRepository.findByItemIdAndItem_DeletedAtIsNull(itemId);
        if (calendar.isPresent()) {
            syncCalendarEvent(calendar.get());
            return;
        }

        Optional<NextAction> nextAction = nextActionRepository.findByItemIdAndItem_DeletedAtIsNull(itemId);
        if (nextAction.isPresent()) {
            syncNextActionEvent(nextAction.get());
            return;
        }

        deleteCalendarEvent(itemId);
    }

    /**
     * Mirrors the current GTD next action state into the derived Google calendars.
     *
     * <p>Example: {@code syncService.syncNextActionEvent(nextAction)}.</p>
     */
    public void syncNextActionEvent(NextAction nextAction) {
        Optional<GtdGoogleCalendarIds> readyIds = findReadyCalendarIds();
        if (readyIds.isEmpty()) return;

        UUID itemId = requireItemId(nextAction);
        GtdGoogleCalendarIds calendarIds = readyIds.get();
        if (!mirrorableNextAction(nextAction)) {
            deleteCalendarEvent(itemId);
            return;
        }

        eventGateway.upsertEvent(eventRequest(nextAction, calendarIds, itemId));
        deleteStaleEvents(nextAction, calendarIds, eventId(itemId));
    }

    /**
     * Mirrors the current GTD calendar state into the derived Google calendars.
     *
     * <p>Example: {@code syncService.syncCalendarEvent(calendar)}.</p>
     */
    public void syncCalendarEvent(Calendar calendar) {
        Optional<GtdGoogleCalendarIds> readyIds = findReadyCalendarIds();
        if (readyIds.isEmpty()) return;

        UUID itemId = requireItemId(calendar);
        GtdGoogleCalendarIds calendarIds = readyIds.get();
        eventGateway.upsertEvent(eventRequest(calendar, calendarIds, itemId));
        deleteStaleEvents(calendar, calendarIds, eventId(itemId));
    }

    /**
     * Removes the GTD calendar event from all derived Google calendars.
     *
     * <p>Example: {@code syncService.deleteCalendarEvent(calendar)}.</p>
     */
    public void deleteCalendarEvent(Calendar calendar) {
        deleteCalendarEvent(requireItemId(calendar));
    }

    /**
     * Removes the GTD calendar event for an item from all derived Google calendars.
     *
     * <p>Example: {@code syncService.deleteCalendarEvent(itemId)}.</p>
     */
    public void deleteCalendarEvent(UUID itemId) {
        Optional<GtdGoogleCalendarIds> readyIds = findReadyCalendarIds();
        if (readyIds.isEmpty()) return;

        String id = eventId(itemId);
        GtdGoogleCalendarIds calendarIds = readyIds.get();

        for (String googleCalendarId : calendarIds.allIds()) {
            eventGateway.deleteEvent(new GoogleCalendarEventDeleteRequest(googleCalendarId, id));
        }
    }

    private Optional<GtdGoogleCalendarIds> findReadyCalendarIds() {
        if (googleCalendarService.getValidCredential() == null) return Optional.empty();

        GoogleCalendar calendar = googleCalendarRepository.findByName(CALENDAR_NAME);
        GoogleCalendar nextAction = googleCalendarRepository.findByName(NEXT_ACTION_NAME);
        GoogleCalendar ongoing = googleCalendarRepository.findByName(ONGOING_NAME);
        GoogleCalendar done = googleCalendarRepository.findByName(DONE_NAME);
        return calendarIds(calendar, nextAction, ongoing, done);
    }

    private Optional<GtdGoogleCalendarIds> calendarIds(
        GoogleCalendar calendar,
        GoogleCalendar nextAction,
        GoogleCalendar ongoing,
        GoogleCalendar done
    ) {
        if (missingCalendar(calendar) || missingCalendar(nextAction) || missingCalendar(ongoing) || missingCalendar(done)) return Optional.empty();
        return Optional.of(new GtdGoogleCalendarIds(
            calendar.getGoogleCalendarId(),
            nextAction.getGoogleCalendarId(),
            ongoing.getGoogleCalendarId(),
            done.getGoogleCalendarId()));
    }

    private GoogleCalendarEventRequest eventRequest(
        Calendar calendar,
        GtdGoogleCalendarIds calendarIds,
        UUID itemId
    ) {
        if (calendar.getStatus() == CalendarStatus.DONE) return doneEvent(calendar, calendarIds.doneId(), itemId);
        return activeEvent(calendar, calendarIds.targetId(calendar.getStatus()), itemId);
    }

    private GoogleCalendarEventRequest eventRequest(
        NextAction nextAction,
        GtdGoogleCalendarIds calendarIds,
        UUID itemId
    ) {
        if (nextAction.getStatus() == NextActionStatus.DONE) return doneEvent(nextAction, calendarIds.doneId(), itemId);
        if (nextAction.getStatus() == NextActionStatus.ONGOING) return ongoingEvent(nextAction, calendarIds.ongoingId(), itemId);
        return allDayEvent(nextAction.getItem().getTitle().value(), calendarIds.nextActionId(), itemId, nextAction.getDeadline(), nextAction.getDeadline());
    }

    private boolean mirrorableNextAction(NextAction nextAction) {
        return nextAction.getDeadline() != null || nextAction.getStatus() != NextActionStatus.NEXT_ACTION;
    }

    private GoogleCalendarEventRequest activeEvent(Calendar calendar, String googleCalendarId, UUID itemId) {
        if (calendar.getScheduledTime() == null) {
            return allDayEvent(calendar.getItem().getTitle().value(), googleCalendarId, itemId, calendar.getScheduledDate(), calendar.getScheduledDate());
        }
        LocalDateTime start = LocalDateTime.of(calendar.getScheduledDate(), calendar.getScheduledTime());
        return timedEvent(calendar.getItem().getTitle().value(), googleCalendarId, itemId, start, start.plusMinutes(30));
    }

    private GoogleCalendarEventRequest doneEvent(Calendar calendar, String googleCalendarId, UUID itemId) {
        return scheduledEvent(calendar.getItem().getTitle().value(), googleCalendarId, itemId, calendar.getSchedule());
    }

    private GoogleCalendarEventRequest ongoingEvent(NextAction nextAction, String googleCalendarId, UUID itemId) {
        ScheduleWindow schedule = nextAction.getSchedule();
        LocalDateTime start = LocalDateTime.of(schedule.getDateStart(), schedule.getTimeStart());
        return timedEvent(nextAction.getItem().getTitle().value(), googleCalendarId, itemId, start, start.plusMinutes(30));
    }

    private GoogleCalendarEventRequest doneEvent(NextAction nextAction, String googleCalendarId, UUID itemId) {
        ScheduleWindow schedule = nextAction.getSchedule();
        if (missingDoneSchedule(schedule)) {
            LocalDate completedDate = fallbackDoneDate(nextAction);
            return allDayEvent(nextAction.getItem().getTitle().value(), googleCalendarId, itemId, completedDate, completedDate);
        }
        return scheduledEvent(nextAction.getItem().getTitle().value(), googleCalendarId, itemId, schedule);
    }

    private GoogleCalendarEventRequest scheduledEvent(String title, String googleCalendarId, UUID itemId, ScheduleWindow schedule) {
        if (schedule.isAllDay()) return allDayEvent(title, googleCalendarId, itemId, schedule.getDateStart(), schedule.getDateEnd());
        LocalDateTime start = LocalDateTime.of(schedule.getDateStart(), schedule.getTimeStart());
        LocalDateTime end = LocalDateTime.of(schedule.getDateEnd(), schedule.getTimeEnd());
        return timedEvent(title, googleCalendarId, itemId, start, end);
    }

    private boolean missingDoneSchedule(ScheduleWindow schedule) {
        return schedule == null || schedule.getDateStart() == null || schedule.getDateEnd() == null;
    }

    private LocalDate fallbackDoneDate(NextAction nextAction) {
        if (nextAction.getUpdatedAt() == null) return LocalDate.now();
        return LocalDateTime.ofInstant(nextAction.getUpdatedAt(), ZoneId.systemDefault()).toLocalDate();
    }

    private GoogleCalendarEventRequest allDayEvent(
        String title,
        String googleCalendarId,
        UUID itemId,
        LocalDate start,
        LocalDate end
    ) {
        return new GoogleCalendarEventRequest(
            googleCalendarId,
            eventId(itemId),
            title,
            start,
            end.plusDays(1),
            null,
            null);
    }

    private GoogleCalendarEventRequest timedEvent(
        String title,
        String googleCalendarId,
        UUID itemId,
        LocalDateTime start,
        LocalDateTime end
    ) {
        return new GoogleCalendarEventRequest(
            googleCalendarId,
            eventId(itemId),
            title,
            null,
            null,
            start,
            end);
    }

    private void deleteStaleEvents(Calendar calendar, GtdGoogleCalendarIds calendarIds, String eventId) {
        for (String googleCalendarId : calendarIds.staleIds(calendar.getStatus())) {
            eventGateway.deleteEvent(new GoogleCalendarEventDeleteRequest(googleCalendarId, eventId));
        }
    }

    private void deleteStaleEvents(NextAction nextAction, GtdGoogleCalendarIds calendarIds, String eventId) {
        for (String googleCalendarId : calendarIds.staleIds(nextAction.getStatus())) {
            eventGateway.deleteEvent(new GoogleCalendarEventDeleteRequest(googleCalendarId, eventId));
        }
    }

    private UUID requireItemId(Calendar calendar) {
        UUID itemId = calendar.getItemId();
        if (itemId != null) return itemId;
        if (calendar.getItem().getId() != null) return calendar.getItem().getId();
        throw new IllegalArgumentException("calendar itemId value 'null' is invalid; expected persisted UUID");
    }

    private UUID requireItemId(NextAction nextAction) {
        UUID itemId = nextAction.getItemId();
        if (itemId != null) return itemId;
        if (nextAction.getItem().getId() != null) return nextAction.getItem().getId();
        throw new IllegalArgumentException("next action itemId value 'null' is invalid; expected persisted UUID");
    }

    private String eventId(UUID itemId) {
        return itemId.toString().replace("-", "");
    }

    private boolean missingCalendar(GoogleCalendar calendar) {
        return calendar == null || calendar.getGoogleCalendarId() == null || calendar.getGoogleCalendarId().isBlank();
    }

    private record GtdGoogleCalendarIds(String calendarId, String nextActionId, String ongoingId, String doneId) {

        private String targetId(CalendarStatus status) {
            if (status == CalendarStatus.ONGOING) return ongoingId;
            if (status == CalendarStatus.DONE) return doneId;
            return calendarId;
        }

        private String targetId(NextActionStatus status) {
            if (status == NextActionStatus.ONGOING) return ongoingId;
            if (status == NextActionStatus.DONE) return doneId;
            return nextActionId;
        }

        private java.util.List<String> staleIds(CalendarStatus status) {
            return java.util.stream.Stream.of(calendarId, nextActionId, ongoingId, doneId)
                .filter(id -> !id.equals(targetId(status)))
                .toList();
        }

        private java.util.List<String> staleIds(NextActionStatus status) {
            return java.util.stream.Stream.of(calendarId, nextActionId, ongoingId, doneId)
                .filter(id -> !id.equals(targetId(status)))
                .toList();
        }

        private java.util.List<String> allIds() {
            return java.util.List.of(calendarId, nextActionId, ongoingId, doneId);
        }
    }
}
