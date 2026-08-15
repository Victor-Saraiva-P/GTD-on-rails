package com.gtdonrails.api.services;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.entities.RecurringCalendarTemplate;
import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
import org.springframework.stereotype.Component;

@Component
public class RecurringCalendarOccurrencePlanner {

    /**
     * Expands one template into intended occurrence dates within the rolling horizon.
     *
     * <p>Example: {@code planner.occurrenceDates(template, LocalDate.now())}.</p>
     */
    public List<LocalDate> occurrenceDates(RecurringCalendarTemplate template, LocalDate today) {
        LocalDate start = laterDate(today, template.getStartDate());
        LocalDate end = earlierDate(today.plusMonths(12), template.getEndDate());
        if (end.isBefore(start)) return List.of();
        if (template.getRecurrenceUnit() == RecurringCalendarIntervalUnit.WEEK) return weeklyOccurrenceDates(template, start, end);
        if (template.getRecurrenceUnit() == RecurringCalendarIntervalUnit.DAY) return dailyOccurrenceDates(template, start, end);
        if (template.getRecurrenceUnit() == RecurringCalendarIntervalUnit.MONTH) return monthlyOccurrenceDates(template, start, end);
        if (template.getRecurrenceUnit() == RecurringCalendarIntervalUnit.YEAR) return yearlyOccurrenceDates(template, start, end);
        throw new IllegalArgumentException(
            "recurrenceUnit value '" + template.getRecurrenceUnit() + "' is invalid; expected implemented recurrence unit");
    }

    private List<LocalDate> dailyOccurrenceDates(
        RecurringCalendarTemplate template,
        LocalDate start,
        LocalDate end
    ) {
        LocalDate firstDate = alignedDailyStartDate(template, start);
        if (firstDate.isAfter(end)) return List.of();
        return firstDate.datesUntil(end.plusDays(1), Period.ofDays(template.getIntervalValue())).toList();
    }

    private LocalDate alignedDailyStartDate(RecurringCalendarTemplate template, LocalDate start) {
        if (!start.isAfter(template.getStartDate())) return template.getStartDate();
        long daysBetween = ChronoUnit.DAYS.between(template.getStartDate(), start);
        int interval = template.getIntervalValue();
        long remainder = daysBetween % interval;
        if (remainder == 0) return start;
        return start.plusDays(interval - remainder);
    }

    private List<LocalDate> weeklyOccurrenceDates(
        RecurringCalendarTemplate template,
        LocalDate start,
        LocalDate end
    ) {
        List<DayOfWeek> weekdays = selectedWeekdays(template);
        return start.datesUntil(end.plusDays(1))
            .filter(date -> weekdays.contains(date.getDayOfWeek()))
            .filter(date -> weekIntervalMatches(template, date))
            .toList();
    }

    private List<LocalDate> monthlyOccurrenceDates(
        RecurringCalendarTemplate template,
        LocalDate start,
        LocalDate end
    ) {
        List<LocalDate> dates = new ArrayList<>();
        YearMonth month = YearMonth.from(template.getStartDate());
        while (!month.atDay(1).isAfter(end)) {
            LocalDate date = monthDate(month, template.getStartDate().getDayOfMonth());
            if (!date.isBefore(start) && !date.isAfter(end)) dates.add(date);
            month = month.plusMonths(template.getIntervalValue());
        }
        return dates;
    }

    private List<LocalDate> yearlyOccurrenceDates(
        RecurringCalendarTemplate template,
        LocalDate start,
        LocalDate end
    ) {
        List<LocalDate> dates = new ArrayList<>();
        int year = template.getStartDate().getYear();
        while (year <= end.getYear()) {
            LocalDate date = yearDate(template.getStartDate(), year);
            if (!date.isBefore(start) && !date.isAfter(end)) dates.add(date);
            year += template.getIntervalValue();
        }
        return dates;
    }

    private List<DayOfWeek> selectedWeekdays(RecurringCalendarTemplate template) {
        List<DayOfWeek> weekdays = template.weeklyWeekdays();
        if (!weekdays.isEmpty()) return weekdays;
        return List.of(template.getStartDate().getDayOfWeek());
    }

    private boolean weekIntervalMatches(RecurringCalendarTemplate template, LocalDate date) {
        LocalDate startWeek = weekStart(template.getStartDate());
        long weekOffset = ChronoUnit.WEEKS.between(startWeek, weekStart(date));
        return weekOffset % template.getIntervalValue() == 0;
    }

    private LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private LocalDate monthDate(YearMonth month, int anchorDay) {
        return month.atDay(Math.min(anchorDay, month.lengthOfMonth()));
    }

    private LocalDate yearDate(LocalDate anchor, int year) {
        YearMonth month = YearMonth.of(year, anchor.getMonthValue());
        return monthDate(month, anchor.getDayOfMonth());
    }

    private LocalDate laterDate(LocalDate first, LocalDate second) {
        return first.isAfter(second) ? first : second;
    }

    private LocalDate earlierDate(LocalDate horizonEnd, LocalDate templateEndDate) {
        if (templateEndDate == null) return horizonEnd;
        return templateEndDate.isBefore(horizonEnd) ? templateEndDate : horizonEnd;
    }
}
