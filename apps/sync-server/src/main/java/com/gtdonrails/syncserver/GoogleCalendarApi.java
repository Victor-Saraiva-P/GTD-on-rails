package com.gtdonrails.syncserver;

import java.io.IOException;
import java.util.List;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.CalendarListEntry;
import com.google.api.services.calendar.model.Event;
import org.springframework.stereotype.Component;

@Component
public class GoogleCalendarApi {

    private final GoogleCalendarOAuthService oauth;

    public GoogleCalendarApi(GoogleCalendarOAuthService oauth) {
        this.oauth = oauth;
    }

    public List<CalendarListEntry> calendars() {
        try {
            return client().calendarList().list().execute().getItems();
        } catch (IOException exception) {
            throw failure("list calendars", exception);
        }
    }

    public String createCalendar(String name) {
        try {
            var calendar = new com.google.api.services.calendar.model.Calendar();
            calendar.setSummary(name);
            return client().calendars().insert(calendar).execute().getId();
        } catch (IOException exception) {
            throw failure("create calendar", exception);
        }
    }

    public void updateCalendarColor(String calendarId, String colorHex) {
        try {
            CalendarListEntry entry = new CalendarListEntry();
            entry.setId(calendarId);
            entry.setBackgroundColor(colorHex);
            entry.setForegroundColor("#FFFFFF");
            client().calendarList().update(calendarId, entry)
                .setColorRgbFormat(true)
                .execute();
        } catch (IOException exception) {
            throw failure("update calendar color", exception);
        }
    }

    public void upsertEvent(String calendarId, Event event) {
        try {
            Event existing = client().events().get(calendarId, event.getId()).execute();
            client().events().update(calendarId, event.getId(), mergeEventId(event, existing)).execute();
        } catch (GoogleJsonResponseException exception) {
            if (!notFound(exception)) throw failure("read calendar event", exception);
            insertEvent(calendarId, event);
        } catch (IOException exception) {
            throw failure("upsert calendar event", exception);
        }
    }

    public void deleteEvent(String calendarId, String eventId) {
        try {
            client().events().delete(calendarId, eventId).execute();
        } catch (GoogleJsonResponseException exception) {
            if (!notFound(exception)) throw failure("delete calendar event", exception);
        } catch (IOException exception) {
            throw failure("delete calendar event", exception);
        }
    }

    private void insertEvent(String calendarId, Event event) {
        try {
            client().events().insert(calendarId, event).execute();
        } catch (IOException exception) {
            throw failure("insert calendar event", exception);
        }
    }

    private Event mergeEventId(Event desired, Event existing) {
        desired.setId(existing.getId());
        return desired;
    }

    private Calendar client() {
        HttpRequestInitializer initializer = request ->
            request.getHeaders().setAuthorization("Bearer " + oauth.accessToken());
        return new Calendar.Builder(
            new NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            initializer
        ).setApplicationName("GTD-on-Rails").build();
    }

    private boolean notFound(GoogleJsonResponseException exception) {
        return exception.getStatusCode() == 404 || exception.getStatusCode() == 410;
    }

    private IllegalStateException failure(String action, Exception exception) {
        return new IllegalStateException("Failed to " + action + " in Google Calendar", exception);
    }
}
