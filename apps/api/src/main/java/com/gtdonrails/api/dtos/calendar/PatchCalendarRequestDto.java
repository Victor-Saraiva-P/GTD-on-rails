package com.gtdonrails.api.dtos.calendar;

import java.time.LocalDate;
import java.time.LocalTime;

public record PatchCalendarRequestDto(
    String scheduledDate,
    String scheduledTime
) {

    /**
     * Reports whether the patch includes a scheduled date change.
     *
     * <p>Example: {@code request.hasScheduledDate()}.</p>
     */
    public boolean hasScheduledDate() {
        return scheduledDate != null;
    }

    /**
     * Reports whether the patch includes a scheduled time change.
     *
     * <p>Example: {@code request.hasScheduledTime()}.</p>
     */
    public boolean hasScheduledTime() {
        return scheduledTime != null;
    }

    /**
     * Returns the requested local date.
     *
     * <p>Example: {@code request.toScheduledDate()}.</p>
     */
    public LocalDate toScheduledDate() {
        return CalendarRequestDates.parseRequiredDate(scheduledDate);
    }

    /**
     * Returns the requested optional local time.
     *
     * <p>Example: {@code request.toScheduledTime()}.</p>
     */
    public LocalTime toScheduledTime() {
        return CalendarRequestDates.parseOptionalTime(scheduledTime);
    }
}
