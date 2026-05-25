package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class CalendarTests {

    @Test
    void constructorAssociatesItemAndRequiredDate() {
        Item item = new Item(new Title("Appointment"), null);

        Calendar calendar = new Calendar(item, LocalDate.parse("2026-05-21"), null);

        assertEquals(calendar, item.getCalendar());
        assertEquals(item, calendar.getItem());
        assertEquals(LocalDate.parse("2026-05-21"), calendar.getScheduledDate());
        assertNull(calendar.getScheduledTime());
        assertEquals(CalendarStatus.CALENDAR, calendar.getStatus());
    }

    @Test
    void setScheduledDateRejectsNull() {
        Calendar calendar = calendar();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> calendar.setScheduledDate(null));

        assertEquals("scheduledDate value 'null' is invalid; expected LocalDate", exception.getMessage());
    }

    @Test
    void constructorAcceptsOptionalScheduledTime() {
        Item item = new Item(new Title("Appointment"), null);

        Calendar calendar = new Calendar(item, LocalDate.parse("2026-05-21"), LocalTime.parse("09:30"));

        assertEquals(LocalTime.parse("09:30"), calendar.getScheduledTime());
    }

    @Test
    void setScheduledTimeAcceptsNull() {
        Calendar calendar = calendar();

        calendar.setScheduledTime(null);

        assertNull(calendar.getScheduledTime());
    }

    @Test
    void constructorCreatesUnscheduledSchedule() {
        Calendar calendar = calendar();

        assertNotNull(calendar.getSchedule());
        assertFalse(calendar.getSchedule().isAllDay());
    }

    @Test
    void markOnGoingUpdatesStatusAndStart() {
        Calendar calendar = calendar();

        calendar.markOnGoing(clockAt("2026-05-21T08:00:00Z"));

        assertEquals(CalendarStatus.ONGOING, calendar.getStatus());
        assertEquals("2026-05-21", calendar.getSchedule().getDateStart().toString());
        assertEquals("08:00", calendar.getSchedule().getTimeStart().toString());
        assertNull(calendar.getSchedule().getDateEnd());
        assertNull(calendar.getSchedule().getTimeEnd());
    }

    @Test
    void markDoneUpdatesStatusAndEnd() {
        Calendar calendar = calendar();
        calendar.markOnGoing(clockAt("2026-05-21T08:00:00Z"));

        calendar.markDone(clockAt("2026-05-21T09:00:00Z"));

        assertEquals(CalendarStatus.DONE, calendar.getStatus());
        assertEquals("2026-05-21", calendar.getSchedule().getDateEnd().toString());
        assertEquals("09:00", calendar.getSchedule().getTimeEnd().toString());
    }

    @Test
    void restoreReturnsToCalendarAndClearsSchedule() {
        Calendar calendar = calendar();
        calendar.markOnGoing(clockAt("2026-05-21T08:00:00Z"));
        calendar.markDone(clockAt("2026-05-21T09:00:00Z"));

        calendar.resetStatus();

        assertEquals(CalendarStatus.CALENDAR, calendar.getStatus());
        assertNull(calendar.getSchedule().getDateStart());
        assertNull(calendar.getSchedule().getDateEnd());
        assertNull(calendar.getSchedule().getTimeStart());
        assertNull(calendar.getSchedule().getTimeEnd());
    }

    private Calendar calendar() {
        Item item = new Item(new Title("Appointment"), null);
        return new Calendar(item, LocalDate.parse("2026-05-21"), null);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }
}
