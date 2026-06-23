package com.gtdonrails.api.dtos.recurring;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

import com.gtdonrails.api.dtos.calendar.CalendarRequestDates;
import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record ConvertStuffToRecurringCalendarTemplateRequestDto(
    @NotBlank(message = "startDate is required")
    String startDate,
    String scheduledTime,
    @Positive(message = "intervalValue must be positive")
    int intervalValue,
    @NotBlank(message = "recurrenceUnit is required")
    String recurrenceUnit,
    List<String> weeklyWeekdays,
    String endDate
) {

    /**
     * Returns the recurrence start date.
     *
     * <p>Example: {@code request.toStartDate()}.</p>
     */
    public LocalDate toStartDate() {
        return CalendarRequestDates.parseRequiredDate(startDate);
    }

    /**
     * Returns the optional local scheduled time.
     *
     * <p>Example: {@code request.toScheduledTime()}.</p>
     */
    public LocalTime toScheduledTime() {
        return CalendarRequestDates.parseOptionalTime(scheduledTime);
    }

    /**
     * Returns the recurrence interval unit.
     *
     * <p>Example: {@code request.toRecurrenceUnit()}.</p>
     */
    public RecurringCalendarIntervalUnit toRecurrenceUnit() {
        return RecurringCalendarIntervalUnit.fromWire(recurrenceUnit);
    }

    /**
     * Returns selected weekly recurrence weekdays.
     *
     * <p>Example: {@code request.toWeeklyWeekdays()}.</p>
     */
    public List<DayOfWeek> toWeeklyWeekdays() {
        if (weeklyWeekdays == null) return List.of();
        return weeklyWeekdays.stream().map(this::parseWeekday).distinct().toList();
    }

    /**
     * Returns the optional recurrence end date.
     *
     * <p>Example: {@code request.toEndDate()}.</p>
     */
    public LocalDate toEndDate() {
        if (endDate == null || endDate.isBlank()) return null;
        return parseEndDate(endDate);
    }

    private DayOfWeek parseWeekday(String value) {
        try {
            return DayOfWeek.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "weeklyWeekday value '" + value + "' is invalid; expected Monday through Sunday",
                exception);
        }
    }

    private LocalDate parseEndDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                "endDate value '" + value + "' is invalid; expected YYYY-MM-DD",
                exception);
        }
    }
}
