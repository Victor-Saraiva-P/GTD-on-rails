package com.gtdonrails.api.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.services.CacheInvalidationService;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class ProjectAssociationPersistenceTests {

    @Autowired private WebApplicationContext applicationContext;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectItemRepository projectItemRepository;
    @Autowired private ItemRepository itemRepository;
    @Autowired private CacheInvalidationService cacheInvalidationService;
    @Autowired private JdbcTemplate jdbcTemplate;

    private final ObjectMapper json = new ObjectMapper();
    private MockMvc mockMvc;
    private UUID projectId;
    private UUID itemId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
        cacheInvalidationService.evictAll();
        projectItemRepository.deleteAllInBatch();
        projectRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();

        Item projectItem = itemRepository.save(new Item(new Title("Test Project"), null));
        Project project = projectRepository.save(new Project(projectItem, null));
        projectId = project.getItemId();

        Item stuffItem = itemRepository.save(new Item(new Title("Actionable Item"), null));
        itemId = stuffItem.getId();

        jdbcTemplate.update("DELETE FROM sync_outbox");
    }

    @Test
    void assigningProjectWritesOutboxInsertEvent() throws Exception {
        assignProjectToItem(itemId, projectId);

        List<Map<String, Object>> events = outboxEventsFor("project_items", itemId);
        assertEquals(1, events.size(), "Assigning project must create one outbox event");
        assertEquals("INSERT", events.get(0).get("operation"));

        JsonNode payload = json.readTree((String) events.get(0).get("payload"));
        assertEquals(itemId.toString(), payload.get("item_id").asText());
        assertEquals(projectId.toString(), payload.get("project_id").asText());
    }

    @Test
    void unassigningProjectWritesOutboxDeleteEvent() throws Exception {
        assignProjectToItem(itemId, projectId);
        jdbcTemplate.update("DELETE FROM sync_outbox");

        unassignProjectFromItem(itemId);

        List<Map<String, Object>> events = outboxEventsFor("project_items", itemId);
        assertEquals(1, events.size(), "Unassigning project must create a DELETE outbox event");
        assertEquals("DELETE", events.get(0).get("operation"));

        JsonNode payload = json.readTree((String) events.get(0).get("payload"));
        assertEquals(itemId.toString(), payload.get("item_id").asText());
    }

    private void assignProjectToItem(UUID itemUuid, UUID projectUuid) throws Exception {
        String payload = json.writeValueAsString(Map.of("projectId", projectUuid));
        mockMvc.perform(put("/items/{id}/project", itemUuid)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk());
    }

    private void unassignProjectFromItem(UUID itemUuid) throws Exception {
        mockMvc.perform(delete("/items/{id}/project", itemUuid))
            .andExpect(status().isOk());
    }

    private List<Map<String, Object>> outboxEventsFor(String entityType, UUID entityId) {
        return jdbcTemplate.queryForList(
            "SELECT operation, payload FROM sync_outbox WHERE entity_type = ? AND entity_id = ? ORDER BY id",
            entityType, entityId.toString()
        );
    }
}
