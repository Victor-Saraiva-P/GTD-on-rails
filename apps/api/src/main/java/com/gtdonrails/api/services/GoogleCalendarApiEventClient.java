package com.gtdonrails.api.services;

import java.io.IOException;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.services.calendar.model.Event;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoogleCalendarApiEventClient implements GoogleCalendarEventClient {

    private static final int NOT_FOUND = 404;
    // Google returns 410 when deleting an event that was already removed.
    private static final int GONE = 410;

    private final GoogleCalendarService googleCalendarService;

    @Override
    public Event getEvent(String googleCalendarId, String eventId) throws IOException {
        try {
            return googleCalendarService.getCalendarClient()
                .events()
                .get(googleCalendarId, eventId)
                .execute();
        } catch (GoogleJsonResponseException exception) {
            if (isAlreadyAbsent(exception)) throw eventNotFound(eventId, exception);
            throw exception;
        }
    }

    @Override
    public void insertEvent(String googleCalendarId, Event event) throws IOException {
        googleCalendarService.getCalendarClient()
            .events()
            .insert(googleCalendarId, event)
            .execute();
    }

    @Override
    public void updateEvent(String googleCalendarId, String eventId, Event event) throws IOException {
        googleCalendarService.getCalendarClient()
            .events()
            .update(googleCalendarId, eventId, event)
            .execute();
    }

    @Override
    public void deleteEvent(String googleCalendarId, String eventId) throws IOException {
        try {
            googleCalendarService.getCalendarClient()
                .events()
                .delete(googleCalendarId, eventId)
                .execute();
        } catch (GoogleJsonResponseException exception) {
            if (isAlreadyAbsent(exception)) throw eventNotFound(eventId, exception);
            throw exception;
        }
    }

    private boolean isAlreadyAbsent(GoogleJsonResponseException exception) {
        int status = exception.getStatusCode();
        return status == NOT_FOUND || status == GONE;
    }

    private GoogleCalendarEventNotFoundException eventNotFound(String eventId, Throwable cause) {
        return new GoogleCalendarEventNotFoundException(eventId, cause);
    }
}
