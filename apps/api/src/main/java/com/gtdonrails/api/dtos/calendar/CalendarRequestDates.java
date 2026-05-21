package com.gtdonrails.api.dtos.calendar;

import java.time.LocalDate;
import java.time.LocalTime;

public final class CalendarRequestDates {

    private CalendarRequestDates() {
    }

    /**
     * Parses a required calendar date from the API's local date shape.
     *
     * <p>Example: {@code CalendarRequestDates.parseRequiredDate("2026-05-21")}.</p>
     */
    public static LocalDate parseRequiredDate(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                "scheduledDate value '" + value + "' is invalid; expected YYYY-MM-DD");
        }
        return parseDateValue(value);
    }

    /**
     * Parses an optional calendar time from the API's local time shape.
     *
     * <p>Example: {@code CalendarRequestDates.parseOptionalTime("09:30")}.</p>
     */
    public static LocalTime parseOptionalTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseTimeValue(value);
    }

    private static LocalDate parseDateValue(String value) {
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "scheduledDate value '" + value + "' is invalid; expected YYYY-MM-DD",
                exception);
        }
    }

    private static LocalTime parseTimeValue(String value) {
        try {
            return LocalTime.parse(value);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "scheduledTime value '" + value + "' is invalid; expected HH:mm",
                exception);
        }
    }
}
