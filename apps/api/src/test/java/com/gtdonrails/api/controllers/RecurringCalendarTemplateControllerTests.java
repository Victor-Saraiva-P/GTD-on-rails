package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.gtdonrails.api.dtos.recurring.ConvertStuffToRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.dtos.recurring.RecurringCalendarTemplateResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.RecurringCalendarTemplateRepository;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import com.gtdonrails.api.services.RecurringCalendarTemplateService;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class RecurringCalendarTemplateControllerTests {

    private static final Clock TEST_CLOCK = clockAt("2026-02-28T12:00:00Z");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private RecurringCalendarTemplateService recurringCalendarTemplateService;

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

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        calendarRepository.deleteAll();
        recurringCalendarTemplateRepository.deleteAll();
        itemRepository.deleteAll();
    }

    @Test
    void listsActiveRecurringCalendarTemplatesOnly() throws Exception {
        RecurringCalendarTemplateResponseDto active = createTemplate("Active recurring work");
        RecurringCalendarTemplateResponseDto deleted = createTemplate("Deleted recurring work");
        softDeleteTemplateItem(deleted);

        mockMvc.perform(get("/recurring-calendar-templates"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(active.id().toString()))
            .andExpect(jsonPath("$[0].title").value("Active recurring work"));
    }

    @Test
    void patchesRecurringCalendarTemplate() throws Exception {
        RecurringCalendarTemplateResponseDto template = createTemplate("Old recurring work");

        mockMvc.perform(patch("/recurring-calendar-templates/{id}", template.id())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Updated recurring work",
                      "startDate": "2026-05-21",
                      "scheduledTime": "10:15",
                      "intervalValue": 1,
                      "recurrenceUnit": "day",
                      "weeklyWeekdays": [],
                      "endDate": "2026-05-21"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Updated recurring work"))
            .andExpect(jsonPath("$.scheduledTime").value("10:15:00"));
    }

    @Test
    void patchesRecurringCalendarTemplateBody() throws Exception {
        RecurringCalendarTemplateResponseDto template = createTemplate("Body recurring work");

        mockMvc.perform(patch("/recurring-calendar-templates/{id}/body", template.id())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "body": {
                        "text": "Updated body",
                        "inlineMarks": [],
                        "lineBlocks": [],
                        "blockEntities": []
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.body.text").value("Updated body"));
    }

    @Test
    void deletesAndRestoresRecurringCalendarTemplate() throws Exception {
        RecurringCalendarTemplateResponseDto template = createTemplate("Restorable recurring work");

        mockMvc.perform(delete("/recurring-calendar-templates/{id}", template.id()))
            .andExpect(status().isNoContent());

        mockMvc.perform(post("/recurring-calendar-templates/{id}/restore", template.id()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(template.id().toString()))
            .andExpect(jsonPath("$.title").value("Restorable recurring work"));
    }

    private RecurringCalendarTemplateResponseDto createTemplate(String title) {
        Item stuff = itemRepository.save(new Item(new Title(title), null));
        return recurringCalendarTemplateService.convertStuffToRecurringCalendarTemplate(stuff.getId(), request());
    }

    private ConvertStuffToRecurringCalendarTemplateRequestDto request() {
        return new ConvertStuffToRecurringCalendarTemplateRequestDto(
            "2026-05-21", null, 1, "day", List.of(), "2026-05-21");
    }

    private void softDeleteTemplateItem(RecurringCalendarTemplateResponseDto template) {
        Item item = itemRepository.findById(template.id()).orElseThrow();
        item.softDelete();
        itemRepository.save(item);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }

    @TestConfiguration
    static class FixedRecurringCalendarTemplateControllerClockConfiguration {

        @Bean
        @Primary
        Clock recurringCalendarTemplateControllerTestClock() {
            return TEST_CLOCK;
        }
    }
}
