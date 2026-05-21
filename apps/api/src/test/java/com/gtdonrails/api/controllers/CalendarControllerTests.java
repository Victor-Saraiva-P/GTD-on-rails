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
import java.time.LocalTime;
import java.time.ZoneId;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class CalendarControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private ItemRepository itemRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        calendarRepository.deleteAll();
        itemRepository.deleteAll();
    }

    @Test
    void getsTodayDueAndLateCalendars() throws Exception {
        Calendar lateCalendar = saveCalendar("Late", "2026-05-20", null);
        saveCalendar("Future", "2026-05-22", null);

        mockMvc.perform(get("/calendars/today"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(lateCalendar.getItemId().toString()));
    }

    @Test
    void getsDoneTodayCalendars() throws Exception {
        Calendar calendar = saveCalendar("Done", "2026-05-21", null);
        calendar.markDone(clockAt("2026-05-21T12:00:00Z"));
        calendarRepository.save(calendar);

        mockMvc.perform(get("/calendars/done/today"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].status").value(CalendarStatus.DONE.name()));
    }

    @Test
    void getsWeekCalendarsByDateRange() throws Exception {
        Calendar calendar = saveCalendar("Wednesday", "2026-05-20", "09:30");
        saveCalendar("Outside", "2026-05-25", null);

        mockMvc.perform(get("/calendars/week?start=2026-05-18"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(calendar.getItemId().toString()))
            .andExpect(jsonPath("$[0].scheduledTime").value("09:30:00"));
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
    void marksCalendarOngoingDoneAndRestored() throws Exception {
        Calendar calendar = saveCalendar("Appointment", "2026-05-21", null);

        mockMvc.perform(post("/calendars/{id}/ongoing", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(CalendarStatus.ONGOING.name()));

        mockMvc.perform(post("/calendars/{id}/done", calendar.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(CalendarStatus.DONE.name()));

        mockMvc.perform(post("/calendars/{id}/restore", calendar.getItemId()))
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

    private LocalTime parseTime(String time) {
        return time == null ? null : LocalTime.parse(time);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }
}
