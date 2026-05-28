package com.gtdonrails.api.services;

import java.time.LocalDate;
import java.time.LocalDateTime;

record GoogleCalendarEventRequest(
    String googleCalendarId,
    String eventId,
    String title,
    LocalDate allDayStartDate,
    LocalDate allDayEndDate,
    LocalDateTime dateTimeStart,
    LocalDateTime dateTimeEnd
) {

    boolean isAllDay() {
        return allDayStartDate != null;
    }
}
