package com.gtdonrails.api.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.services.CacheInvalidationService;
import com.gtdonrails.api.services.SupabasePullSyncService;
import com.gtdonrails.api.services.SupabasePushSyncService;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
class NextActionEditPersistenceTests {
    @Autowired private WebApplicationContext applicationContext;
    @Autowired private NextActionRepository nextActionRepository;
    @Autowired private ItemRepository itemRepository;
    @Autowired private ContextRepository contextRepository;
    @Autowired private CacheInvalidationService cacheInvalidationService;
    @Autowired private JdbcTemplate jdbcTemplate;
    private final ObjectMapper json = new ObjectMapper();
    private MockMvc mockMvc;
    private Context home;
    private Context office;
    private UUID actionId;

    @BeforeEach
    void prepareEditableAction() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
        cacheInvalidationService.evictAll();
        nextActionRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
        home = contextRepository.save(new Context("Home"));
        office = contextRepository.save(new Context("Office"));
        Item item = itemRepository.save(new Item(new Title("Persistence probe"), "Original body"));
        NextAction action = new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(home));
        action.setDeadline(LocalDate.of(2028, 2, 29));
        actionId = nextActionRepository.save(action).getItemId();
        jdbcTemplate.update("DELETE FROM sync_outbox");
    }

    @ParameterizedTest
    @ValueSource(strings = {"add", "replace", "clear", "remove"})
    void contextsSurvivePushPullAndFreshRead(String operation) throws Exception {
        Set<UUID> expected = selectedContextIds(operation);
        FakeSupabaseContextJdbc remote = new FakeSupabaseContextJdbc(actionId, localContextIds());
        jdbcTemplate.update("DELETE FROM sync_outbox");
        patchAttribute("/next-actions/" + actionId, json.writeValueAsString(java.util.Map.of("contextIds", expected)));
        assertEquals(expected, localContextIds());
        SupabasePushSyncService push = new SupabasePushSyncService(remote);
        pendingActionEvents().forEach(push::pushEvent);
        jdbcTemplate.update("UPDATE sync_outbox SET status = 'COMPLETED'");
        new SupabasePullSyncService(remote, jdbcTemplate).pullAll();
        cacheInvalidationService.evictAll();
        assertEquals(expected, localContextIds(), "Edited contexts must survive the remote pull and fresh page read");
        assertEquals(expected, remote.savedContextIds(), "Edited contexts must reach remote storage");
    }

    private Set<UUID> selectedContextIds(String operation) throws Exception {
        if (operation.equals("add")) return Set.of(home.getId(), office.getId());
        if (operation.equals("replace")) return Set.of(office.getId());
        if (operation.equals("clear")) return Set.of();
        patchAttribute("/next-actions/" + actionId,
            json.writeValueAsString(java.util.Map.of("contextIds", Set.of(home.getId(), office.getId()))));
        return Set.of(home.getId());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "{\"energy\":8.5}|energy|8.5",
        "{\"energy\":0}|energy|0.0",
        "{\"estimatedTime\":{\"hours\":1,\"minutes\":30}}|estimated_time_minutes|90",
        "{\"estimatedTime\":{\"hours\":0,\"minutes\":0}}|estimated_time_minutes|0",
        "{\"deadline\":\"2029-01-01\"}|deadline|2029-01-01",
        "{\"clearDeadline\":true}|deadline|null"
    })
    void metadataEditsPersistAndProduceRemotePayload(String patchJson, String column, String expected) throws Exception {
        patchAttribute("/next-actions/" + actionId, patchJson);
        assertOutboxColumn("next_actions", column, expected);
        NextAction stored = nextActionRepository.findById(actionId).orElseThrow();
        String actual = switch (column) {
            case "energy" -> stored.getEnergy().setScale(1).toPlainString();
            case "estimated_time_minutes" -> Long.toString(stored.getEstimatedTime().toMinutes());
            default -> String.valueOf(stored.getDeadline());
        };
        assertEquals(expected, actual);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "title|{\"title\":\"Revised title\"}|title|Revised title",
        "body|{\"body\":{\"text\":\"Revised body\",\"inlineMarks\":[],\"lineBlocks\":[],\"blockEntities\":[]}}|body|Revised body",
        "body|{\"body\":null}|body|''"
    })
    void contentEditsProduceRemotePayload(String route, String patchJson, String column, String expected) throws Exception {
        patchAttribute("/items/" + actionId + "/" + route, patchJson);
        JsonNode payload = latestPayload("items");
        String actual = payload.get(column).asText();
        if (column.equals("body") && !actual.equals("null")) actual = json.readTree(actual).get("text").asText();
        assertEquals(expected, actual);
        Item saved = itemRepository.findById(actionId).orElseThrow();
        assertEquals(expected, column.equals("title") ? saved.getTitle().value() : saved.getBody().text());
    }

    @ParameterizedTest
    @CsvSource({"ongoing,ONGOING", "done,DONE", "reset-status,NEXT_ACTION"})
    void statusEditsProduceRemotePayload(String route, String expected) throws Exception {
        if (route.equals("reset-status")) mockMvc.perform(post("/next-actions/{id}/ongoing", actionId)).andExpect(status().isOk());
        mockMvc.perform(post("/next-actions/{id}/" + route, actionId)).andExpect(status().isOk());
        assertOutboxColumn("next_actions", "status", expected);
    }

    private void patchAttribute(String endpoint, String patchJson) throws Exception {
        mockMvc.perform(patch(endpoint).contentType(MediaType.APPLICATION_JSON).content(patchJson))
            .andExpect(status().isOk());
    }

    private Set<UUID> localContextIds() throws Exception {
        String response = mockMvc.perform(get("/next-actions?orderBy=energy"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Set<UUID> ids = new java.util.HashSet<>();
        for (JsonNode context : json.readTree(response).get(0).get("contexts")) ids.add(UUID.fromString(context.get("id").asText()));
        return ids;
    }

    private List<SyncOutboxEvent> pendingActionEvents() {
        return jdbcTemplate.query("SELECT operation, payload FROM sync_outbox WHERE entity_type = 'next_actions' AND entity_id = ? ORDER BY id",
            (row, index) -> new SyncOutboxEvent("next_actions", actionId.toString(),
                SyncOutboxOperation.valueOf(row.getString(1)), row.getString(2)), actionId.toString());
    }

    private JsonNode latestPayload(String table) throws Exception {
        List<String> payloads = jdbcTemplate.queryForList(
            "SELECT payload FROM sync_outbox WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC",
            String.class, table, actionId.toString());
        assertFalse(payloads.isEmpty(), "Edit must emit a remote payload for " + table);
        return json.readTree(payloads.getFirst());
    }

    private void assertOutboxColumn(String table, String column, String expected) throws Exception {
        assertEquals(expected, latestPayload(table).get(column).asText());
    }
}
