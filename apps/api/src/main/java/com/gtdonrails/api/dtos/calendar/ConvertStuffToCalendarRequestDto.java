package com.gtdonrails.api.dtos.calendar;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;

public record ConvertStuffToCalendarRequestDto(
    @NotBlank(message = "scheduledDate is required")
    String scheduledDate,
    String scheduledTime
) {

    /**
     * Returns the required local date for calendar conversion.
     *
     * <p>Example: {@code request.toScheduledDate()}.</p>
     */
    public LocalDate toScheduledDate() {
        return CalendarRequestDates.parseRequiredDate(scheduledDate);
    }

    /**
     * Returns the optional local time for calendar conversion.
     *
     * <p>Example: {@code request.toScheduledTime()}.</p>
     */
    public LocalTime toScheduledTime() {
        return CalendarRequestDates.parseOptionalTime(scheduledTime);
    }
}
