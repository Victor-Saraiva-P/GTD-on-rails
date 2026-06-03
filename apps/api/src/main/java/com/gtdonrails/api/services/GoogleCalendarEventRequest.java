package com.gtdonrails.api.services;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record GoogleCalendarEventRequest(
    String googleCalendarId,
    String eventId,
    String title,
    LocalDate allDayStartDate,
    LocalDate allDayEndDate,
    LocalDateTime dateTimeStart,
    LocalDateTime dateTimeEnd
) {

    public GoogleCalendarEventRequest {
        boolean validAllDay = hasCompleteAllDayShape(allDayStartDate, allDayEndDate, dateTimeStart, dateTimeEnd);
        boolean validTimed = hasCompleteTimedShape(allDayStartDate, allDayEndDate, dateTimeStart, dateTimeEnd);
        if (!validAllDay && !validTimed) {
            throw new IllegalArgumentException(
                "google calendar event request values allDayStartDate='" + allDayStartDate
                    + "', allDayEndDate='" + allDayEndDate
                    + "', dateTimeStart='" + dateTimeStart
                    + "', dateTimeEnd='" + dateTimeEnd
                    + "' are invalid; expected either all-day shape with both all-day dates and no timed dates"
                    + " or timed shape with both timed dates and no all-day dates");
        }
    }

    boolean isAllDay() {
        return allDayStartDate != null;
    }

    private static boolean hasCompleteAllDayShape(
        LocalDate allDayStartDate,
        LocalDate allDayEndDate,
        LocalDateTime dateTimeStart,
        LocalDateTime dateTimeEnd
    ) {
        return allDayStartDate != null && allDayEndDate != null && dateTimeStart == null && dateTimeEnd == null;
    }

    private static boolean hasCompleteTimedShape(
        LocalDate allDayStartDate,
        LocalDate allDayEndDate,
        LocalDateTime dateTimeStart,
        LocalDateTime dateTimeEnd
    ) {
        return allDayStartDate == null && allDayEndDate == null && dateTimeStart != null && dateTimeEnd != null;
    }
}
