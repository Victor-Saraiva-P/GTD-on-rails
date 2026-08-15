package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.RecurringCalendarTemplate;
import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RecurringCalendarOccurrencePlannerTests {

    private RecurringCalendarOccurrencePlanner planner;

    @BeforeEach
    void setUp() {
        planner = new RecurringCalendarOccurrencePlanner();
    }

    @Test
    void dailyRecurrenceAlignsCadenceWhenTodayIsOffsetFromStartDate() {
        RecurringCalendarTemplate template = createTemplate(
            LocalDate.parse("2026-05-01"), 3, RecurringCalendarIntervalUnit.DAY, List.of(), LocalDate.parse("2026-05-15"));

        LocalDate today = LocalDate.parse("2026-05-02");
        List<LocalDate> dates = planner.occurrenceDates(template, today);

        assertEquals(List.of(
            LocalDate.parse("2026-05-04"),
            LocalDate.parse("2026-05-07"),
            LocalDate.parse("2026-05-10"),
            LocalDate.parse("2026-05-13")),
            dates);
    }

    @Test
    void dailyRecurrenceIncludesTodayWhenTodayMatchesCadence() {
        RecurringCalendarTemplate template = createTemplate(
            LocalDate.parse("2026-05-01"), 2, RecurringCalendarIntervalUnit.DAY, List.of(), LocalDate.parse("2026-05-09"));

        LocalDate today = LocalDate.parse("2026-05-05");
        List<LocalDate> dates = planner.occurrenceDates(template, today);

        assertEquals(List.of(
            LocalDate.parse("2026-05-05"),
            LocalDate.parse("2026-05-07"),
            LocalDate.parse("2026-05-09")),
            dates);
    }

    @Test
    void dailyRecurrenceStartsFromStartDateWhenTodayIsBeforeStartDate() {
        RecurringCalendarTemplate template = createTemplate(
            LocalDate.parse("2026-06-01"), 2, RecurringCalendarIntervalUnit.DAY, List.of(), LocalDate.parse("2026-06-07"));

        LocalDate today = LocalDate.parse("2026-05-20");
        List<LocalDate> dates = planner.occurrenceDates(template, today);

        assertEquals(List.of(
            LocalDate.parse("2026-06-01"),
            LocalDate.parse("2026-06-03"),
            LocalDate.parse("2026-06-05"),
            LocalDate.parse("2026-06-07")),
            dates);
    }

    @Test
    void weeklyRecurrenceFiltersSelectedWeekdaysAndMatchesCadence() {
        RecurringCalendarTemplate template = createTemplate(
            LocalDate.parse("2026-05-01"), 2, RecurringCalendarIntervalUnit.WEEK,
            List.of(DayOfWeek.MONDAY, DayOfWeek.FRIDAY), LocalDate.parse("2026-05-25"));

        LocalDate today = LocalDate.parse("2026-05-01");
        List<LocalDate> dates = planner.occurrenceDates(template, today);

        assertEquals(List.of(
            LocalDate.parse("2026-05-01"),
            LocalDate.parse("2026-05-11"),
            LocalDate.parse("2026-05-15"),
            LocalDate.parse("2026-05-25")),
            dates);
    }

    private RecurringCalendarTemplate createTemplate(
        LocalDate startDate,
        int intervalValue,
        RecurringCalendarIntervalUnit unit,
        List<DayOfWeek> weekdays,
        LocalDate endDate
    ) {
        Item item = new Item(new Title("Test template"), null);
        return item.convertToRecurringCalendarTemplate(
            startDate, null, intervalValue, unit, weekdays, endDate);
    }
}
