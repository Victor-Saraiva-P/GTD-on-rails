package com.gtdonrails.api.dtos.calendar;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.ScheduleWindow;

public record CalendarResponseDto(
    UUID id,
    String title,
    ItemBody body,
    LocalDate scheduledDate,
    LocalTime scheduledTime,
    String status,
    ScheduleWindow schedule,
    UUID projectId,
    String projectTitle
) {
    public CalendarResponseDto(
        UUID id,
        String title,
        ItemBody body,
        LocalDate scheduledDate,
        LocalTime scheduledTime,
        String status,
        ScheduleWindow schedule,
        String projectTitle
    ) {
        this(id, title, body, scheduledDate, scheduledTime, status, schedule, null, projectTitle);
    }
}
