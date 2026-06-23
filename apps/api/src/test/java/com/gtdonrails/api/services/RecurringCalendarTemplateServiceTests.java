package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import com.gtdonrails.api.dtos.recurring.ConvertStuffToRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.dtos.recurring.RecurringCalendarTemplateResponseDto;
import com.gtdonrails.api.dtos.recurring.UpdateRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.dtos.calendar.PatchCalendarRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.RecurringCalendarTemplateRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class RecurringCalendarTemplateServiceTests {

    private static final Clock TEST_CLOCK = clockAt("2026-02-28T12:00:00Z");

    @Autowired
    private RecurringCalendarTemplateService recurringCalendarTemplateService;

    @Autowired
    private CalendarService calendarService;

    @Autowired
    private ItemService itemService;

    @Autowired
    private RecurringCalendarTemplateRepository recurringCalendarTemplateRepository;

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private ItemRepository itemRepository;

    @MockitoBean
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    @MockitoBean
    private PersistenceGitSyncService persistenceGitSyncService;

    @BeforeEach
    void setUp() {
        calendarRepository.deleteAll();
        recurringCalendarTemplateRepository.deleteAll();
        itemRepository.deleteAll();
    }

    @Test
    void convertStuffToDailyRecurringCalendarTemplateCreatesIdempotentOccurrences() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), "Bring bins"));
        ConvertStuffToRecurringCalendarTemplateRequestDto request = dailyRequest();

        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), request);
        recurringCalendarTemplateService.refreshTemplateHorizon(template.id());

        List<Calendar> occurrences = calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id());
        Item convertedItem = itemRepository.findById(stuff.getId()).orElseThrow();
        assertEquals(ItemStatus.RECURRING_CALENDAR_TEMPLATE, convertedItem.getStatus());
        assertEquals("Take out trash", template.title());
        assertEquals(3, occurrences.size());
        assertOccurrence(occurrences.get(0), "2026-05-21", "09:30");
        assertOccurrence(occurrences.get(2), "2026-05-23", "09:30");
    }

    @Test
    void weeklyRecurringCalendarTemplateCreatesSelectedWeekdaysOnOrAfterStartDate() {
        Item stuff = itemRepository.save(new Item(new Title("Water plants"), null));
        ConvertStuffToRecurringCalendarTemplateRequestDto request = weeklyRequest();

        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), request);

        List<Calendar> occurrences = calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id());
        assertEquals(List.of(
            LocalDate.parse("2026-05-22"),
            LocalDate.parse("2026-05-25")),
            occurrenceDates(occurrences));
    }

    @Test
    void monthlyRecurringCalendarTemplateUsesLastValidMonthDay() {
        Item stuff = itemRepository.save(new Item(new Title("Pay month-end bill"), null));
        ConvertStuffToRecurringCalendarTemplateRequestDto request = monthlyRequest();

        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), request);

        List<Calendar> occurrences = calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id());
        assertEquals(List.of(
            LocalDate.parse("2026-05-31"),
            LocalDate.parse("2026-06-30"),
            LocalDate.parse("2026-07-31")),
            occurrenceDates(occurrences));
    }

    @Test
    void yearlyRecurringCalendarTemplateUsesFebruaryTwentyEightAfterLeapDayAnchor() {
        Item stuff = itemRepository.save(new Item(new Title("Renew leap-day reminder"), null));
        ConvertStuffToRecurringCalendarTemplateRequestDto request = yearlyRequest();

        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), request);

        List<Calendar> occurrences = calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id());
        assertEquals(List.of(
            LocalDate.parse("2026-02-28"),
            LocalDate.parse("2027-02-28")),
            occurrenceDates(occurrences));
    }

    @Test
    void updatingTemplatePropagatesTitleAndScheduledTimeToOccurrences() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), null));
        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), dailyRequest());

        recurringCalendarTemplateService.updateTemplate(template.id(), updateRequest());

        List<Calendar> occurrences = calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id());
        assertEquals("Take bins out", occurrences.get(0).getItem().getTitle().value());
        assertEquals(LocalTime.parse("10:15"), occurrences.get(0).getScheduledTime());
        assertEquals(LocalTime.parse("10:15"), occurrences.get(0).getOriginalScheduledTime());
        assertEquals(3, occurrences.size());
    }

    @Test
    void directOccurrenceScheduleEditPersonalizesAndSkipsFutureTemplateUpdates() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), null));
        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), dailyRequest());
        Calendar occurrence = firstOccurrence(template);

        calendarService.patchCalendar(
            occurrence.getItemId(), new PatchCalendarRequestDto("2026-05-24", "08:00"));
        recurringCalendarTemplateService.updateTemplate(template.id(), updateRequest());

        Calendar personalized = calendarRepository.findById(occurrence.getItemId()).orElseThrow();
        assertEquals(true, personalized.isPersonalizedOccurrence());
        assertEquals("Take out trash", personalized.getItem().getTitle().value());
        assertEquals(LocalDate.parse("2026-05-24"), personalized.getScheduledDate());
        assertEquals(LocalTime.parse("08:00"), personalized.getScheduledTime());
    }

    @Test
    void directOccurrenceTitleEditPersonalizesAndSkipsFutureTemplateUpdates() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), null));
        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), dailyRequest());
        Calendar occurrence = firstOccurrence(template);

        itemService.updateItemTitle(occurrence.getItemId(), new UpdateItemTitleRequestDto("Custom trash"));
        recurringCalendarTemplateService.updateTemplate(template.id(), updateRequest());

        Calendar personalized = calendarRepository.findById(occurrence.getItemId()).orElseThrow();
        assertEquals(true, personalized.isPersonalizedOccurrence());
        assertEquals("Custom trash", personalized.getItem().getTitle().value());
    }

    @Test
    void deletingTemplateSoftDeletesTemplateAndHardDeletesFutureDefaultOccurrences() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), null));
        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), dailyRequest());

        recurringCalendarTemplateService.deleteTemplate(template.id());

        Item deletedTemplate = itemRepository.findById(template.id()).orElseThrow();
        List<Calendar> occurrences = calendarRepository.findAllByRecurringCalendarTemplate_ItemId(template.id());
        assertEquals(true, deletedTemplate.isDeleted());
        assertEquals(0, occurrences.size());
    }

    @Test
    void restoringTemplateRegeneratesFutureDefaultOccurrences() {
        Item stuff = itemRepository.save(new Item(new Title("Take out trash"), null));
        RecurringCalendarTemplateResponseDto template = recurringCalendarTemplateService
            .convertStuffToRecurringCalendarTemplate(stuff.getId(), dailyRequest());
        recurringCalendarTemplateService.deleteTemplate(template.id());

        recurringCalendarTemplateService.restoreTemplate(template.id());

        Item restoredTemplate = itemRepository.findById(template.id()).orElseThrow();
        List<Calendar> occurrences = calendarRepository.findAllByRecurringCalendarTemplate_ItemId(template.id());
        assertEquals(false, restoredTemplate.isDeleted());
        assertEquals(3, occurrences.size());
    }

    private ConvertStuffToRecurringCalendarTemplateRequestDto dailyRequest() {
        return new ConvertStuffToRecurringCalendarTemplateRequestDto(
            "2026-05-21", "09:30", 1, "day", List.of(), "2026-05-23");
    }

    private ConvertStuffToRecurringCalendarTemplateRequestDto weeklyRequest() {
        return new ConvertStuffToRecurringCalendarTemplateRequestDto(
            "2026-05-21", null, 1, "week", List.of("monday", "friday"), "2026-05-25");
    }

    private ConvertStuffToRecurringCalendarTemplateRequestDto monthlyRequest() {
        return new ConvertStuffToRecurringCalendarTemplateRequestDto(
            "2026-05-31", null, 1, "month", List.of(), "2026-07-31");
    }

    private ConvertStuffToRecurringCalendarTemplateRequestDto yearlyRequest() {
        return new ConvertStuffToRecurringCalendarTemplateRequestDto(
            "2024-02-29", null, 1, "year", List.of(), "2027-02-28");
    }

    private UpdateRecurringCalendarTemplateRequestDto updateRequest() {
        return new UpdateRecurringCalendarTemplateRequestDto(
            "Take bins out", "2026-05-21", "10:15", 1, "day", List.of(), "2026-05-23");
    }

    private List<LocalDate> occurrenceDates(List<Calendar> occurrences) {
        return occurrences.stream().map(Calendar::getOriginalScheduledDate).toList();
    }

    private void assertOccurrence(Calendar occurrence, String date, String time) {
        assertEquals("Take out trash", occurrence.getItem().getTitle().value());
        assertEquals(LocalDate.parse(date), occurrence.getScheduledDate());
        assertEquals(LocalDate.parse(date), occurrence.getOriginalScheduledDate());
        assertEquals(LocalTime.parse(time), occurrence.getScheduledTime());
        assertEquals(LocalTime.parse(time), occurrence.getOriginalScheduledTime());
    }

    private Calendar firstOccurrence(RecurringCalendarTemplateResponseDto template) {
        return calendarRepository
            .findAllByRecurringCalendarTemplate_ItemIdOrderByOriginalScheduledDateAsc(template.id())
            .get(0);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }

    @TestConfiguration
    static class FixedRecurringCalendarTemplateClockConfiguration {

        @Bean
        @Primary
        Clock recurringCalendarTemplateServiceTestClock() {
            return TEST_CLOCK;
        }
    }
}
