package com.gtdonrails.api.types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ScheduleWindowTests {

    private static final ZoneId UTC = ZoneId.of("UTC");

    @Test
    void registerStartStoresCurrentDateAndTime() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();

        schedule.registerStart(clockAt("2026-05-10T10:00:00Z"));

        assertEquals("2026-05-10", schedule.getDateStart().toString());
        assertEquals("10:00", schedule.getTimeStart().toString());
        assertNull(schedule.getDateEnd());
        assertNull(schedule.getTimeEnd());
        assertFalse(schedule.isAllDay());
    }

    @Test
    void unscheduledCreatesEmptyNonAllDaySchedule() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();

        assertNull(schedule.getDateStart());
        assertNull(schedule.getDateEnd());
        assertNull(schedule.getTimeStart());
        assertNull(schedule.getTimeEnd());
        assertFalse(schedule.isAllDay());
    }

    @Test
    void registerStartClearsPreviousEnd() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();
        schedule.registerStart(clockAt("2026-05-10T10:00:00Z"));
        schedule.registerEnd(clockAt("2026-05-10T11:00:00Z"));

        schedule.registerStart(clockAt("2026-05-11T09:00:00Z"));

        assertEquals("2026-05-11", schedule.getDateStart().toString());
        assertEquals("09:00", schedule.getTimeStart().toString());
        assertNull(schedule.getDateEnd());
        assertNull(schedule.getTimeEnd());
    }

    @Test
    void registerEndAcceptsNextDayWithEarlierClockTime() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();
        schedule.registerStart(clockAt("2026-05-10T10:00:00Z"));

        schedule.registerEnd(clockAt("2026-05-11T09:00:00Z"));

        assertEquals("2026-05-11", schedule.getDateEnd().toString());
        assertEquals("09:00", schedule.getTimeEnd().toString());
        assertFalse(schedule.isAllDay());
    }

    @Test
    void registerEndRejectsEndBeforeStart() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();
        schedule.registerStart(clockAt("2026-05-11T10:00:00Z"));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> schedule.registerEnd(clockAt("2026-05-10T09:00:00Z")));

        assertEquals("schedule end value '2026-05-10T09:00' is invalid; expected same or after schedule start '2026-05-11T10:00'", exception.getMessage());
    }

    @Test
    void registerEndWithoutStartMarksCurrentDayAllDay() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();

        schedule.registerEnd(clockAt("2026-05-12T15:30:00Z"));

        assertEquals("2026-05-12", schedule.getDateStart().toString());
        assertEquals("2026-05-12", schedule.getDateEnd().toString());
        assertNull(schedule.getTimeStart());
        assertNull(schedule.getTimeEnd());
        assertTrue(schedule.isAllDay());
    }

    @Test
    void registerStartRejectsNullClock() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> schedule.registerStart(null));

        assertEquals("clock value 'null' is invalid; expected Clock", exception.getMessage());
    }

    @Test
    void registerEndRejectsNullClock() {
        ScheduleWindow schedule = ScheduleWindow.unscheduled();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> schedule.registerEnd(null));

        assertEquals("clock value 'null' is invalid; expected Clock", exception.getMessage());
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), UTC);
    }
}
