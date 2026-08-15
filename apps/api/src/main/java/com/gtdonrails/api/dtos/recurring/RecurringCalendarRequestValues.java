package com.gtdonrails.api.dtos.recurring;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

public final class RecurringCalendarRequestValues {

    private RecurringCalendarRequestValues() {
    }

    /**
     * Parses an optional recurrence end date string formatted as YYYY-MM-DD.
     *
     * <p>Example: {@code RecurringCalendarRequestValues.parseOptionalEndDate("2026-12-31")}.</p>
     */
    public static LocalDate parseOptionalEndDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "endDate value '" + value + "' is invalid; expected YYYY-MM-DD",
                exception);
        }
    }

    /**
     * Parses a list of weekday strings into unique DayOfWeek values.
     *
     * <p>Example: {@code RecurringCalendarRequestValues.parseWeeklyWeekdays(List.of("monday", "friday"))}.</p>
     */
    public static List<DayOfWeek> parseWeeklyWeekdays(List<String> weekdays) {
        if (weekdays == null) return List.of();
        return weekdays.stream().map(RecurringCalendarRequestValues::parseWeekday).distinct().toList();
    }

    private static DayOfWeek parseWeekday(String value) {
        try {
            return DayOfWeek.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "weeklyWeekday value '" + value + "' is invalid; expected Monday through Sunday",
                exception);
        }
    }
}
