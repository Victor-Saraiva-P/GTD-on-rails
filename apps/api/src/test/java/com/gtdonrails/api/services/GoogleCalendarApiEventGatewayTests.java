package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.google.api.services.calendar.model.Event;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class GoogleCalendarApiEventGatewayTests {

    @Test
    void upsertInsertsAllDayEventWhenGoogleEventIsAbsent() {
        FakeGoogleCalendarEventClient eventClient = new FakeGoogleCalendarEventClient();
        eventClient.eventExists = false;
        GoogleCalendarApiEventGateway gateway = new GoogleCalendarApiEventGateway(eventClient);

        gateway.upsertEvent(allDayRequest());

        Event inserted = eventClient.insertedEvents.getFirst();
        assertEquals("event-id", inserted.getId());
        assertEquals("Review inbox", inserted.getSummary());
        assertEquals("2026-06-02", inserted.getStart().getDate().toStringRfc3339());
        assertEquals("2026-06-03", inserted.getEnd().getDate().toStringRfc3339());
        assertNull(inserted.getStart().getDateTime());
    }

    @Test
    void upsertUpdatesTimedEventWhenGoogleEventExists() {
        FakeGoogleCalendarEventClient eventClient = new FakeGoogleCalendarEventClient();
        GoogleCalendarApiEventGateway gateway = new GoogleCalendarApiEventGateway(eventClient);

        gateway.upsertEvent(timedRequest());

        Event updated = eventClient.updatedEvents.getFirst();
        assertEquals("event-id", eventClient.updatedEventIds.getFirst());
        assertEquals("Review inbox", updated.getSummary());
        assertNotNull(updated.getStart().getDateTime());
        assertNotNull(updated.getEnd().getDateTime());
        assertEquals(ZoneId.systemDefault().getId(), updated.getStart().getTimeZone());
        assertNull(updated.getStart().getDate());
    }

    @Test
    void deleteIgnoresAbsentGoogleEvent() {
        FakeGoogleCalendarEventClient eventClient = new FakeGoogleCalendarEventClient();
        eventClient.deleteFailure = notFound();
        GoogleCalendarApiEventGateway gateway = new GoogleCalendarApiEventGateway(eventClient);

        gateway.deleteEvent(deleteRequest());

        assertEquals(List.of("event-id"), eventClient.deletedEventIds);
    }

    @Test
    void deleteWrapsGoogleFailuresWithEventId() {
        FakeGoogleCalendarEventClient eventClient = new FakeGoogleCalendarEventClient();
        eventClient.deleteFailure = new IOException("network failed");
        GoogleCalendarApiEventGateway gateway = new GoogleCalendarApiEventGateway(eventClient);

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> gateway.deleteEvent(deleteRequest()));

        assertEquals("google event value 'event-id' is invalid; expected deletable event", exception.getMessage());
    }

    @Test
    void upsertWrapsGoogleFailuresWithEventId() {
        FakeGoogleCalendarEventClient eventClient = new FakeGoogleCalendarEventClient();
        eventClient.updateFailure = new IOException("network failed");
        GoogleCalendarApiEventGateway gateway = new GoogleCalendarApiEventGateway(eventClient);

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> gateway.upsertEvent(timedRequest()));

        assertEquals("google event value 'event-id' is invalid; expected upsertable event", exception.getMessage());
    }

    private GoogleCalendarEventRequest allDayRequest() {
        return new GoogleCalendarEventRequest(
            "calendar-id",
            "event-id",
            "Review inbox",
            LocalDate.parse("2026-06-02"),
            LocalDate.parse("2026-06-03"),
            null,
            null);
    }

    private GoogleCalendarEventRequest timedRequest() {
        return new GoogleCalendarEventRequest(
            "calendar-id",
            "event-id",
            "Review inbox",
            null,
            null,
            LocalDateTime.parse("2026-06-02T09:00"),
            LocalDateTime.parse("2026-06-02T09:30"));
    }

    private GoogleCalendarEventDeleteRequest deleteRequest() {
        return new GoogleCalendarEventDeleteRequest("calendar-id", "event-id");
    }

    private GoogleCalendarEventNotFoundException notFound() {
        return new GoogleCalendarEventNotFoundException("event-id", new IOException("not found"));
    }

    private static class FakeGoogleCalendarEventClient implements GoogleCalendarEventClient {

        private final List<Event> insertedEvents = new ArrayList<>();
        private final List<Event> updatedEvents = new ArrayList<>();
        private final List<String> updatedEventIds = new ArrayList<>();
        private final List<String> deletedEventIds = new ArrayList<>();
        private boolean eventExists = true;
        private IOException updateFailure;
        private IOException deleteFailure;

        @Override
        public Event getEvent(String googleCalendarId, String eventId) throws IOException {
            if (!eventExists) throw notFound(eventId);
            return new Event().setId(eventId);
        }

        private GoogleCalendarEventNotFoundException notFound(String eventId) {
            return new GoogleCalendarEventNotFoundException(eventId, new IOException("not found"));
        }

        @Override
        public void insertEvent(String googleCalendarId, Event event) {
            insertedEvents.add(event);
        }

        @Override
        public void updateEvent(String googleCalendarId, String eventId, Event event) throws IOException {
            if (updateFailure != null) throw updateFailure;
            updatedEventIds.add(eventId);
            updatedEvents.add(event);
        }

        @Override
        public void deleteEvent(String googleCalendarId, String eventId) throws IOException {
            deletedEventIds.add(eventId);
            if (deleteFailure != null) throw deleteFailure;
        }
    }
}
