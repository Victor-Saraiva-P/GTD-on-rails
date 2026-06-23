package com.gtdonrails.api.enums;

import java.util.Locale;

public enum RecurringCalendarIntervalUnit {
    DAY,
    WEEK,
    MONTH,
    YEAR;

    /**
     * Parses the API recurrence unit vocabulary.
     *
     * <p>Example: {@code RecurringCalendarIntervalUnit.fromWire("day")}.</p>
     */
    public static RecurringCalendarIntervalUnit fromWire(String value) {
        if (value == null || value.isBlank()) {
            throw invalidUnit(value);
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw invalidUnit(value);
        }
    }

    /**
     * Returns the lowercase API recurrence unit vocabulary.
     *
     * <p>Example: {@code RecurringCalendarIntervalUnit.DAY.toWire()}.</p>
     */
    public String toWire() {
        return name().toLowerCase(Locale.ROOT);
    }

    private static IllegalArgumentException invalidUnit(String value) {
        return new IllegalArgumentException(
            "recurrenceUnit value '" + value + "' is invalid; expected day, week, month, or year");
    }
}
