package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import com.gtdonrails.api.services.CacheInvalidationService;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class ProjectControllerTests {

    private static final Clock TEST_CLOCK = clockAt("2026-05-21T12:34:56Z");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectItemRepository projectItemRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ContextRepository contextRepository;

    @Autowired
    private CacheInvalidationService cacheInvalidationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        cacheInvalidationService.evictAll();
        projectItemRepository.deleteAll();
        projectRepository.deleteAll();
        itemRepository.deleteAll();
    }

    @Test
    void marksProjectDoneWithCompletionDateAndTime() throws Exception {
        Project project = saveProject("Publish release notes");

        mockMvc.perform(post("/projects/{id}/done", project.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(project.getItemId().toString()))
            .andExpect(jsonPath("$.doneDate").value("2026-05-21"))
            .andExpect(jsonPath("$.doneTime").value("12:34:56"));
    }

    @Test
    void getsCompletedProjectsNewestFirst() throws Exception {
        Project olderProject = doneProject("Older", "2026-05-21T09:00:00Z");
        Project newerProject = doneProject("Newer", "2026-05-21T12:00:00Z");

        mockMvc.perform(get("/projects/done"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(newerProject.getItemId().toString()))
            .andExpect(jsonPath("$[1].id").value(olderProject.getItemId().toString()));
    }

    @Test
    void resetsDoneProjectStatusToActive() throws Exception {
        Project project = doneProject("Restore me", "2026-05-21T12:00:00Z");

        mockMvc.perform(post("/projects/{id}/reset-status", project.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.doneDate").value(nullValue()))
            .andExpect(jsonPath("$.doneTime").value(nullValue()));
    }

    @Test
    void activeListExcludesDoneProjects() throws Exception {
        Project activeProject = saveProject("Active outcome");
        doneProject("Done outcome", "2026-05-21T12:00:00Z");

        mockMvc.perform(get("/projects"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(activeProject.getItemId().toString()));
    }

    @Test
    void patchesDoneProjectWithoutRestoringIt() throws Exception {
        Project project = doneProject("Old title", "2026-05-21T12:00:00Z");

        mockMvc.perform(patch("/projects/{id}", project.getItemId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New title\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.doneDate").value("2026-05-21"));
    }

    @Test
    void deletesActiveProjectIntoDeletedProjects() throws Exception {
        Project project = saveProject("Recoverable outcome");

        mockMvc.perform(delete("/projects/{id}", project.getItemId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/projects"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/projects/deleted"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(project.getItemId().toString()));
    }

    @Test
    void recoversDeletedDoneProjectToDoneProjects() throws Exception {
        Project project = doneProject("Recover done", "2026-05-21T12:00:00Z");
        mockMvc.perform(delete("/projects/{id}", project.getItemId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(post("/projects/{id}/recover", project.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.doneDate").value("2026-05-21"));

        mockMvc.perform(get("/projects/done"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(project.getItemId().toString()));
    }

    @Test
    void createsProjectStuffAndListsItInProjectActionsAndInbox() throws Exception {
        Project project = saveProject("Replace CPU");

        String location = mockMvc.perform(post("/projects/{id}/items/stuff", project.getItemId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Buy thermal paste\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.projectId").value(project.getItemId().toString()))
            .andExpect(jsonPath("$.kind").value("STUFF"))
            .andExpect(jsonPath("$.title").value("Buy thermal paste"))
            .andReturn()
            .getResponse()
            .getHeader("Location");

        mockMvc.perform(get("/projects/{id}/items/actions", project.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].kind").value("STUFF"))
            .andExpect(jsonPath("$[0].title").value("Buy thermal paste"));

        mockMvc.perform(get(location))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Buy thermal paste"));

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].title").value("Buy thermal paste"));
    }

    @Test
    void keepsProcessedProjectItemsInProjectActionsOrder() throws Exception {
        Context context = contextRepository.save(new Context("hardware"));
        Project project = saveProject("Replace CPU");
        UUID nextActionId = createProjectStuff(project, "Search thermal paste prices");
        UUID calendarId = createProjectStuff(project, "Buy thermal paste");
        createProjectStuff(project, "Remember screwdriver");

        mockMvc.perform(post("/inbox/{id}/next-action", nextActionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "energy": 4.5,
                      "estimatedTime": { "hours": 1, "minutes": 30 },
                      "contextIds": ["%s"],
                      "deadline": "2026-02-01"
                    }
                    """.formatted(context.getId())))
            .andExpect(status().isNoContent());

        mockMvc.perform(post("/inbox/{id}/calendar", calendarId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduledDate\":\"2026-01-01\",\"scheduledTime\":\"09:30\"}"))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/projects/{id}/items/actions", project.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(3)))
            .andExpect(jsonPath("$[0].kind").value("STUFF"))
            .andExpect(jsonPath("$[1].kind").value("CALENDAR"))
            .andExpect(jsonPath("$[1].scheduledDate").value("2026-01-01"))
            .andExpect(jsonPath("$[2].kind").value("NEXT_ACTION"))
            .andExpect(jsonPath("$[2].deadline").value("2026-02-01"))
            .andExpect(jsonPath("$[2].energy").value(4.5))
            .andExpect(jsonPath("$[2].estimatedTime").value("PT1H30M"))
            .andExpect(jsonPath("$[2].contexts", hasSize(1)))
            .andExpect(jsonPath("$[2].contexts[0].name").value("hardware"));
    }

    private Project saveProject(String title) {
        Item item = new Item(new Title(title), null);
        Project project = item.convertToProject(LocalDate.parse("2026-06-01"));
        itemRepository.saveAndFlush(item);
        return projectRepository.save(project);
    }

    private UUID createProjectStuff(Project project, String title) throws Exception {
        String location = mockMvc.perform(post("/projects/{id}/items/stuff", project.getItemId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"" + title + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getHeader("Location");
        return UUID.fromString(location.substring(location.lastIndexOf('/') + 1));
    }

    private Project doneProject(String title, String instant) {
        Project project = saveProject(title);
        project.markDone(clockAt(instant));
        return projectRepository.save(project);
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }

    @TestConfiguration
    static class FixedProjectClockConfiguration {

        @Bean
        @Primary
        Clock projectControllerTestClock() {
            return TEST_CLOCK;
        }
    }
}
