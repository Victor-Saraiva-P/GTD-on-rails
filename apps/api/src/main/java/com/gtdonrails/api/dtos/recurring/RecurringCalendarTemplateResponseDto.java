package com.gtdonrails.api.dtos.recurring;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;

public record RecurringCalendarTemplateResponseDto(
    UUID id,
    String title,
    ItemBody body,
    LocalDate startDate,
    LocalTime scheduledTime,
    int intervalValue,
    String recurrenceUnit,
    List<String> weeklyWeekdays,
    LocalDate endDate
) {
}
