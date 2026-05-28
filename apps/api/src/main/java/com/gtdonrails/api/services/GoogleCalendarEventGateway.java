package com.gtdonrails.api.services;

public interface GoogleCalendarEventGateway {

    /**
     * Creates or replaces one derived Google event.
     *
     * <p>Example: {@code gateway.upsertEvent(request)}.</p>
     */
    void upsertEvent(GoogleCalendarEventRequest request);

    /**
     * Removes one derived Google event when it exists.
     *
     * <p>Example: {@code gateway.deleteEvent(request)}.</p>
     */
    void deleteEvent(GoogleCalendarEventDeleteRequest request);
}
