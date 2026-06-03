package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpResponseException;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class GoogleCalendarApiEventClientTests {

    private GoogleCalendarService googleCalendarService;
    private Calendar calendarClient;
    private Calendar.Events events;
    private GoogleCalendarApiEventClient eventClient;

    @BeforeEach
    void setUp() throws IOException {
        googleCalendarService = mock(GoogleCalendarService.class);
        calendarClient = mock(Calendar.class);
        events = mock(Calendar.Events.class);
        when(googleCalendarService.getCalendarClient()).thenReturn(calendarClient);
        when(calendarClient.events()).thenReturn(events);
        eventClient = new GoogleCalendarApiEventClient(googleCalendarService);
    }

    @Test
    void getEventReturnsExecutedGoogleEvent() throws IOException {
        Event googleEvent = new Event().setId("event-id");
        Calendar.Events.Get getRequest = mock(Calendar.Events.Get.class);
        when(events.get("calendar-id", "event-id")).thenReturn(getRequest);
        when(getRequest.execute()).thenReturn(googleEvent);

        Event result = eventClient.getEvent("calendar-id", "event-id");

        assertSame(googleEvent, result);
    }

    @Test
    void getEventMapsAbsentGoogleEvent() throws IOException {
        Calendar.Events.Get getRequest = mock(Calendar.Events.Get.class);
        when(events.get("calendar-id", "event-id")).thenReturn(getRequest);
        when(getRequest.execute()).thenThrow(googleFailure(404));

        GoogleCalendarEventNotFoundException exception = assertThrows(
            GoogleCalendarEventNotFoundException.class,
            () -> eventClient.getEvent("calendar-id", "event-id"));

        assertEquals("google event value 'event-id' is invalid; expected existing event", exception.getMessage());
    }

    @Test
    void getEventPropagatesNonAbsentGoogleFailure() throws IOException {
        GoogleJsonResponseException googleFailure = googleFailure(500);
        Calendar.Events.Get getRequest = mock(Calendar.Events.Get.class);
        when(events.get("calendar-id", "event-id")).thenReturn(getRequest);
        when(getRequest.execute()).thenThrow(googleFailure);

        GoogleJsonResponseException exception = assertThrows(
            GoogleJsonResponseException.class,
            () -> eventClient.getEvent("calendar-id", "event-id"));

        assertSame(googleFailure, exception);
    }

    @Test
    void insertEventExecutesGoogleInsert() throws IOException {
        Event googleEvent = new Event().setId("event-id");
        Calendar.Events.Insert insertRequest = mock(Calendar.Events.Insert.class);
        when(events.insert("calendar-id", googleEvent)).thenReturn(insertRequest);

        eventClient.insertEvent("calendar-id", googleEvent);

        verify(insertRequest).execute();
    }

    @Test
    void updateEventExecutesGoogleUpdate() throws IOException {
        Event googleEvent = new Event().setId("event-id");
        Calendar.Events.Update updateRequest = mock(Calendar.Events.Update.class);
        when(events.update("calendar-id", "event-id", googleEvent)).thenReturn(updateRequest);

        eventClient.updateEvent("calendar-id", "event-id", googleEvent);

        verify(updateRequest).execute();
    }

    @Test
    void deleteEventExecutesGoogleDelete() throws IOException {
        Calendar.Events.Delete deleteRequest = mock(Calendar.Events.Delete.class);
        when(events.delete("calendar-id", "event-id")).thenReturn(deleteRequest);

        eventClient.deleteEvent("calendar-id", "event-id");

        verify(deleteRequest).execute();
    }

    @Test
    void deleteEventMapsGoneGoogleEvent() throws IOException {
        Calendar.Events.Delete deleteRequest = mock(Calendar.Events.Delete.class);
        when(events.delete("calendar-id", "event-id")).thenReturn(deleteRequest);
        when(deleteRequest.execute()).thenThrow(googleFailure(410));

        GoogleCalendarEventNotFoundException exception = assertThrows(
            GoogleCalendarEventNotFoundException.class,
            () -> eventClient.deleteEvent("calendar-id", "event-id"));

        assertEquals("google event value 'event-id' is invalid; expected existing event", exception.getMessage());
    }

    @Test
    void deleteEventPropagatesNonAbsentGoogleFailure() throws IOException {
        GoogleJsonResponseException googleFailure = googleFailure(500);
        Calendar.Events.Delete deleteRequest = mock(Calendar.Events.Delete.class);
        when(events.delete("calendar-id", "event-id")).thenReturn(deleteRequest);
        when(deleteRequest.execute()).thenThrow(googleFailure);

        GoogleJsonResponseException exception = assertThrows(
            GoogleJsonResponseException.class,
            () -> eventClient.deleteEvent("calendar-id", "event-id"));

        assertSame(googleFailure, exception);
    }

    private GoogleJsonResponseException googleFailure(int statusCode) {
        HttpResponseException.Builder builder = new HttpResponseException.Builder(
            statusCode,
            "google failed",
            new HttpHeaders());
        return new GoogleJsonResponseException(builder, null);
    }
}
