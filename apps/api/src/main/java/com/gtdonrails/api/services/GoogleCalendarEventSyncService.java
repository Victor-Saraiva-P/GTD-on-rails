package com.gtdonrails.api.services;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.types.ScheduleWindow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoogleCalendarEventSyncService {

    private static final String CALENDAR_NAME = "Calendar";
    private static final String ONGOING_NAME = "On Going";
    private static final String DONE_NAME = "Done";

    private final GoogleCalendarService googleCalendarService;
    private final GoogleCalendarRepository googleCalendarRepository;
    private final GoogleCalendarEventGateway eventGateway;

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
        Optional<GtdGoogleCalendarIds> readyIds = findReadyCalendarIds();
        if (readyIds.isEmpty()) return;

        UUID itemId = requireItemId(calendar);
        String id = eventId(itemId);
        GtdGoogleCalendarIds calendarIds = readyIds.get();

        for (String googleCalendarId : calendarIds.allIds()) {
            eventGateway.deleteEvent(new GoogleCalendarEventDeleteRequest(googleCalendarId, id));
        }
    }

    private Optional<GtdGoogleCalendarIds> findReadyCalendarIds() {
        if (googleCalendarService.getValidCredential() == null) return Optional.empty();

        GoogleCalendar calendar = googleCalendarRepository.findByName(CALENDAR_NAME);
        GoogleCalendar ongoing = googleCalendarRepository.findByName(ONGOING_NAME);
        GoogleCalendar done = googleCalendarRepository.findByName(DONE_NAME);
        return calendarIds(calendar, ongoing, done);
    }

    private Optional<GtdGoogleCalendarIds> calendarIds(
        GoogleCalendar calendar,
        GoogleCalendar ongoing,
        GoogleCalendar done
    ) {
        if (missingCalendar(calendar) || missingCalendar(ongoing) || missingCalendar(done)) return Optional.empty();
        return Optional.of(new GtdGoogleCalendarIds(
            calendar.getGoogleCalendarId(),
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

    private GoogleCalendarEventRequest activeEvent(Calendar calendar, String googleCalendarId, UUID itemId) {
        if (calendar.getScheduledTime() == null) {
            return allDayEvent(calendar, googleCalendarId, itemId, calendar.getScheduledDate(), calendar.getScheduledDate());
        }
        LocalDateTime start = LocalDateTime.of(calendar.getScheduledDate(), calendar.getScheduledTime());
        return timedEvent(calendar, googleCalendarId, itemId, start, start.plusMinutes(30));
    }

    private GoogleCalendarEventRequest doneEvent(Calendar calendar, String googleCalendarId, UUID itemId) {
        ScheduleWindow schedule = calendar.getSchedule();
        if (schedule.isAllDay()) {
            return allDayEvent(calendar, googleCalendarId, itemId, schedule.getDateStart(), schedule.getDateEnd());
        }
        LocalDateTime start = LocalDateTime.of(schedule.getDateStart(), schedule.getTimeStart());
        LocalDateTime end = LocalDateTime.of(schedule.getDateEnd(), schedule.getTimeEnd());
        return timedEvent(calendar, googleCalendarId, itemId, start, end);
    }

    private GoogleCalendarEventRequest allDayEvent(
        Calendar calendar,
        String googleCalendarId,
        UUID itemId,
        LocalDate start,
        LocalDate end
    ) {
        return new GoogleCalendarEventRequest(
            googleCalendarId,
            eventId(itemId),
            calendar.getItem().getTitle().value(),
            start,
            end.plusDays(1),
            null,
            null);
    }

    private GoogleCalendarEventRequest timedEvent(
        Calendar calendar,
        String googleCalendarId,
        UUID itemId,
        LocalDateTime start,
        LocalDateTime end
    ) {
        return new GoogleCalendarEventRequest(
            googleCalendarId,
            eventId(itemId),
            calendar.getItem().getTitle().value(),
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

    private UUID requireItemId(Calendar calendar) {
        UUID itemId = calendar.getItemId();
        if (itemId != null) return itemId;
        if (calendar.getItem().getId() != null) return calendar.getItem().getId();
        throw new IllegalArgumentException("calendar itemId value 'null' is invalid; expected persisted UUID");
    }

    private String eventId(UUID itemId) {
        return itemId.toString().replace("-", "");
    }

    private boolean missingCalendar(GoogleCalendar calendar) {
        return calendar == null || calendar.getGoogleCalendarId() == null || calendar.getGoogleCalendarId().isBlank();
    }

    private record GtdGoogleCalendarIds(String calendarId, String ongoingId, String doneId) {

        private String targetId(CalendarStatus status) {
            if (status == CalendarStatus.ONGOING) return ongoingId;
            if (status == CalendarStatus.DONE) return doneId;
            return calendarId;
        }

        private java.util.List<String> staleIds(CalendarStatus status) {
            return java.util.stream.Stream.of(calendarId, ongoingId, doneId)
                .filter(id -> !id.equals(targetId(status)))
                .toList();
        }

        private java.util.List<String> allIds() {
            return java.util.List.of(calendarId, ongoingId, doneId);
        }
    }
}
