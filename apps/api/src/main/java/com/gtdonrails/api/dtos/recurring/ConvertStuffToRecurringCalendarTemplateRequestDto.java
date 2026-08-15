package com.gtdonrails.api.dtos.recurring;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

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
        return RecurringCalendarRequestValues.parseWeeklyWeekdays(weeklyWeekdays);
    }

    /**
     * Returns the optional recurrence end date.
     *
     * <p>Example: {@code request.toEndDate()}.</p>
     */
    public LocalDate toEndDate() {
        return RecurringCalendarRequestValues.parseOptionalEndDate(endDate);
    }
}
