package com.gtdonrails.api.dtos.recurring;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.gtdonrails.api.dtos.calendar.CalendarRequestDates;
import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record UpdateRecurringCalendarTemplateRequestDto(
    @NotBlank(message = "title is required")
    String title,
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
     * Returns the parsed required start date.
     *
     * <p>Example: {@code request.toStartDate()}.</p>
     */
    public LocalDate toStartDate() {
        return CalendarRequestDates.parseRequiredDate(startDate);
    }

    /**
     * Returns the parsed optional scheduled time.
     *
     * <p>Example: {@code request.toScheduledTime()}.</p>
     */
    public LocalTime toScheduledTime() {
        return CalendarRequestDates.parseOptionalTime(scheduledTime);
    }

    /**
     * Returns the parsed recurrence interval unit.
     *
     * <p>Example: {@code request.toRecurrenceUnit()}.</p>
     */
    public RecurringCalendarIntervalUnit toRecurrenceUnit() {
        return RecurringCalendarIntervalUnit.fromWire(recurrenceUnit);
    }

    /**
     * Returns the parsed weekly weekdays list.
     *
     * <p>Example: {@code request.toWeeklyWeekdays()}.</p>
     */
    public List<DayOfWeek> toWeeklyWeekdays() {
        return RecurringCalendarRequestValues.parseWeeklyWeekdays(weeklyWeekdays);
    }

    /**
     * Returns the parsed optional end date.
     *
     * <p>Example: {@code request.toEndDate()}.</p>
     */
    public LocalDate toEndDate() {
        return RecurringCalendarRequestValues.parseOptionalEndDate(endDate);
    }
}
