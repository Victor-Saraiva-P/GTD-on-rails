package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
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
    private ItemRepository itemRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
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

    private Project saveProject(String title) {
        Item item = itemRepository.save(new Item(new Title(title), null));
        return projectRepository.save(new Project(item, LocalDate.parse("2026-06-01")));
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
