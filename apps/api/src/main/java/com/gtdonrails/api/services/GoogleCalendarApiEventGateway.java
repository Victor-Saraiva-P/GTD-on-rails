package com.gtdonrails.api.services;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoogleCalendarApiEventGateway implements GoogleCalendarEventGateway {

    private static final int NOT_FOUND = 404;

    private final GoogleCalendarService googleCalendarService;

    @Override
    public void upsertEvent(GoogleCalendarEventRequest request) {
        try {
            upsertEventOrThrow(request);
        } catch (IOException exception) {
            throw new IllegalStateException("google event value '" + request.eventId() + "' is invalid; expected upsertable event", exception);
        }
    }

    @Override
    public void deleteEvent(GoogleCalendarEventDeleteRequest request) {
        try {
            googleCalendarService.getCalendarClient()
                .events()
                .delete(request.googleCalendarId(), request.eventId())
                .execute();
        } catch (GoogleJsonResponseException exception) {
            if (exception.getStatusCode() != NOT_FOUND) throw deleteException(request, exception);
        } catch (IOException exception) {
            throw deleteException(request, exception);
        }
    }

    private void upsertEventOrThrow(GoogleCalendarEventRequest request) throws IOException {
        Event event = eventFrom(request);
        if (eventExists(request)) {
            updateEvent(request, event);
            return;
        }
        insertEvent(request, event);
    }

    private boolean eventExists(GoogleCalendarEventRequest request) throws IOException {
        try {
            googleCalendarService.getCalendarClient()
                .events()
                .get(request.googleCalendarId(), request.eventId())
                .execute();
            return true;
        } catch (GoogleJsonResponseException exception) {
            if (exception.getStatusCode() == NOT_FOUND) return false;
            throw exception;
        }
    }

    private void updateEvent(GoogleCalendarEventRequest request, Event event) throws IOException {
        googleCalendarService.getCalendarClient()
            .events()
            .update(request.googleCalendarId(), request.eventId(), event)
            .execute();
    }

    private void insertEvent(GoogleCalendarEventRequest request, Event event) throws IOException {
        googleCalendarService.getCalendarClient()
            .events()
            .insert(request.googleCalendarId(), event)
            .execute();
    }

    private Event eventFrom(GoogleCalendarEventRequest request) {
        Event event = new Event();
        event.setId(request.eventId());
        event.setSummary(request.title());
        applyEventWindow(event, request);
        return event;
    }

    private void applyEventWindow(Event event, GoogleCalendarEventRequest request) {
        if (request.isAllDay()) {
            event.setStart(allDayDate(request.allDayStartDate().toString()));
            event.setEnd(allDayDate(request.allDayEndDate().toString()));
            return;
        }
        event.setStart(dateTime(request.dateTimeStart()));
        event.setEnd(dateTime(request.dateTimeEnd()));
    }

    private EventDateTime allDayDate(String value) {
        return new EventDateTime().setDate(new DateTime(value));
    }

    private EventDateTime dateTime(LocalDateTime value) {
        ZoneId zone = ZoneId.systemDefault();
        Date date = Date.from(value.atZone(zone).toInstant());
        return new EventDateTime().setDateTime(new DateTime(date)).setTimeZone(zone.getId());
    }

    private IllegalStateException deleteException(
        GoogleCalendarEventDeleteRequest request,
        Exception exception
    ) {
        return new IllegalStateException(
            "google event value '" + request.eventId() + "' is invalid; expected deletable event",
            exception);
    }
}
