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

    public LocalDate toStartDate() {
        return CalendarRequestDates.parseRequiredDate(startDate);
    }

    public LocalTime toScheduledTime() {
        return CalendarRequestDates.parseOptionalTime(scheduledTime);
    }

    public RecurringCalendarIntervalUnit toRecurrenceUnit() {
        return RecurringCalendarIntervalUnit.fromWire(recurrenceUnit);
    }

    public List<DayOfWeek> toWeeklyWeekdays() {
        if (weeklyWeekdays == null) return List.of();
        return weeklyWeekdays.stream().map(this::parseWeekday).distinct().toList();
    }

    public LocalDate toEndDate() {
        if (endDate == null || endDate.isBlank()) return null;
        return LocalDate.parse(endDate);
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
}
