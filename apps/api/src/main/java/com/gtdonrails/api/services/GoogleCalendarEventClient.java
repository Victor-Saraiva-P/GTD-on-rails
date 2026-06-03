package com.gtdonrails.api.services;

import java.io.IOException;

import com.google.api.services.calendar.model.Event;

public interface GoogleCalendarEventClient {

    /**
     * Loads one Google event from a GTD Google Calendar.
     *
     * <p>Example: {@code eventClient.getEvent("calendar-id", "event-id")}.</p>
     */
    Event getEvent(String googleCalendarId, String eventId) throws IOException;

    /**
     * Creates one Google event in a GTD Google Calendar.
     *
     * <p>Example: {@code eventClient.insertEvent("calendar-id", event)}.</p>
     */
    void insertEvent(String googleCalendarId, Event event) throws IOException;

    /**
     * Replaces one Google event in a GTD Google Calendar.
     *
     * <p>Example: {@code eventClient.updateEvent("calendar-id", "event-id", event)}.</p>
     */
    void updateEvent(String googleCalendarId, String eventId, Event event) throws IOException;

    /**
     * Removes one Google event from a GTD Google Calendar.
     *
     * <p>Example: {@code eventClient.deleteEvent("calendar-id", "event-id")}.</p>
     */
    void deleteEvent(String googleCalendarId, String eventId) throws IOException;
}
