package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.math.BigDecimal;
import java.util.Set;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import com.gtdonrails.api.services.CacheInvalidationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class CalendarControllerTests {

    private static final Clock TEST_CLOCK = clockAt("2026-05-21T12:00:00Z");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private NextActionRepository nextActionRepository;

    @Autowired
    private CacheInvalidationService cacheInvalidationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        cacheInvalidationService.evictAll();
        nextActionRepository.deleteAll();
        calendarRepository.deleteAll();
        itemRepository.deleteAll();
    }

    @Test
    void getsAggregatedTodayCalendarEntriesForClientLocalDate() throws Exception {
        Calendar scheduled = saveCalendar("Meeting", "2026-05-21", "09:30");
        NextAction overdue = saveNextAction("Overdue action", "2026-05-20");
        NextAction dueToday = saveNextAction("Due action", "2026-05-21");
        saveNextAction("Future action", "2026-05-22");

        mockMvc.perform(get("/calendars/today?localDate=2026-05-21"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(3)))
            .andExpect(jsonPath("$[0].id").value(scheduled.getItemId().toString()))
            .andExpect(jsonPath("$[0].sourceKind").value("CALENDAR"))
            .andExpect(jsonPath("$[0].temporalState").value("SCHEDULED_TODAY"))
            .andExpect(jsonPath("$[1].id").value(overdue.getItemId().toString()))
            .andExpect(jsonPath("$[1].sourceKind").value("NEXT_ACTION"))
            .andExpect(jsonPath("$[1].temporalState").value("OVERDUE"))
            .andExpect(jsonPath("$[2].id").value(dueToday.getItemId().toString()))
            .andExpect(jsonPath("$[2].temporalState").value("DUE_TODAY"));
    }

    @Test
    void getsDoneTodayAcrossCalendarItemsAndDueNextActions() throws Exception {
        Calendar calendar = saveCalendar("Done calendar", "2026-05-21", null);
        calendar.markOnGoing(clockAt("2026-05-21T10:00:00Z"));
        calendar.markDone(clockAt("2026-05-21T11:00:00Z"));
        calendarRepository.save(calendar);
        NextAction dueAction = saveNextAction("Done due action", "2026-05-20");
        dueAction.markOnGoing(clockAt("2026-05-21T11:30:00Z"));
        dueAction.markDone(clockAt("2026-05-21T12:00:00Z"));
        nextActionRepository.save(dueAction);
        Thread.sleep(5);
        calendar.setScheduledTime(LocalTime.parse("08:00"));
        calendarRepository.save(calendar);
        NextAction earlyAction = saveNextAction("Done early action", "2026-05-22");
        earlyAction.markDone(clockAt("2026-05-21T13:00:00Z"));
        itemRepository.save(earlyAction.getItem());

        mockMvc.perform(get("/calendars/done/today?localDate=2026-05-21"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(dueAction.getItemId().toString()))
            .andExpect(jsonPath("$[0].sourceKind").value("NEXT_ACTION"))
            .andExpect(jsonPath("$[0].schedule.timeEnd").value("12:00:00"))
            .andExpect(jsonPath("$[1].id").value(calendar.getItemId().toString()))
            .andExpect(jsonPath("$[1].sourceKind").value("CALENDAR"))
            .andExpect(jsonPath("$[1].schedule.timeEnd").value("11:00:00"));
    }

    @Test
    void getsActiveWeekEntriesAcrossCalendarItemsAndNextActions() throws Exception {
        Calendar calendar = saveCalendar("Wednesday", "2026-05-20", "09:30");
        NextAction nextAction = saveNextAction("Friday action", "2026-05-22");
        Calendar completed = saveCalendar("Completed", "2026-05-19", null);
        completed.markDone(TEST_CLOCK);
        calendarRepository.save(completed);
        saveCalendar("Outside", "2026-05-25", null);

        mockMvc.perform(get("/calendars/week?start=2026-05-18"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(calendar.getItemId().toString()))
            .andExpect(jsonPath("$[0].scheduledTime").value("09:30:00"))
            .andExpect(jsonPath("$[1].id").value(nextAction.getItemId().toString()))
            .andExpect(jsonPath("$[1].deadline").value("2026-05-22"))
            .andExpect(jsonPath("$[1].sourceKind").value("NEXT_ACTION"));
    }

    @Test
    void patchesCalendarScheduling() throws Exception {
        Calendar calendar = saveCalendar("Appointment", "2026-05-21", null);

        mockMvc.perform(patch("/calendars/{id}", calendar.getItemId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduledDate\":\"2026-05-22\",\"scheduledTime\":\"10:15\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduledDate").value("2026-05-22"))
            .andExpect(jsonPath("$.scheduledTime").value("10:15:00"));
    }

    @Test
    void marksCalendarOngoingDoneAndReset() throws Exception {
        Calendar calendar = saveCalendar("Appointment", "2026-05-21", null);

        mockMvc.perform(post("/calendars/{id}/ongoing", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(CalendarStatus.ONGOING.name()));

        mockMvc.perform(post("/calendars/{id}/done", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(CalendarStatus.DONE.name()));

        mockMvc.perform(post("/calendars/{id}/reset-status", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(CalendarStatus.CALENDAR.name()));
    }

    @Test
    void recoversDeletedCalendar() throws Exception {
        Calendar calendar = saveCalendar("Deleted", "2026-05-21", null);
        calendar.getItem().softDelete();
        itemRepository.save(calendar.getItem());

        mockMvc.perform(post("/calendars/{id}/recover", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(calendar.getItemId().toString()));
    }

    private Calendar saveCalendar(String title, String date, String time) {
        Item item = itemRepository.save(new Item(new Title(title), null));
        Calendar calendar = new Calendar(item, LocalDate.parse(date), parseTime(time));
        return calendarRepository.save(calendar);
    }

    private NextAction saveNextAction(String title, String deadline) {
        Item item = itemRepository.save(new Item(new Title(title), null));
        NextAction nextAction = item.convertToNextAction(BigDecimal.ZERO, Duration.ZERO, Set.of());
        nextAction.setDeadline(LocalDate.parse(deadline));
        itemRepository.save(item);
        return nextActionRepository.findById(item.getId()).orElseThrow();
    }

    private LocalTime parseTime(String time) {
        return time == null ? null : LocalTime.parse(time);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }

    @TestConfiguration
    static class FixedCalendarClockConfiguration {

        @Bean
        @Primary
        Clock calendarControllerTestClock() {
            return TEST_CLOCK;
        }
    }
}
