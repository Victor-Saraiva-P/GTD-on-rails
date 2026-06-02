package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class GoogleCalendarEventRequestTests {

    @Test
    void acceptsCompleteAllDayShape() {
        assertDoesNotThrow(() -> new GoogleCalendarEventRequest(
            "calendar-id", "event-id", "title", LocalDate.parse("2026-06-02"), LocalDate.parse("2026-06-03"), null, null));
    }

    @Test
    void acceptsCompleteTimedShape() {
        assertDoesNotThrow(() -> new GoogleCalendarEventRequest(
            "calendar-id", "event-id", "title", null, null, LocalDateTime.parse("2026-06-02T09:00"), LocalDateTime.parse("2026-06-02T09:30")));
    }

    @Test
    void rejectsPartialOrMixedEventShape() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> new GoogleCalendarEventRequest(
            "calendar-id", "event-id", "title", LocalDate.parse("2026-06-02"), null, LocalDateTime.parse("2026-06-02T09:00"), null));

        assertTrue(exception.getMessage().contains("allDayStartDate='2026-06-02'"));
        assertTrue(exception.getMessage().contains("all-day shape"));
        assertTrue(exception.getMessage().contains("timed shape"));
    }
}
