package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Field;
import java.time.Instant;

import com.gtdonrails.api.entities.AuditableEntity;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextRepository;
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
class InboxControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ContextRepository contextRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void createsStuffWithTitleOnly() throws Exception {
        mockMvc.perform(post("/inbox")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" Capture idea \"}"))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", containsString("/inbox/")))
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.title").value("Capture idea"))
            .andExpect(jsonPath("$.body.text").value(""))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void getsOnlyActiveStuff() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Visible stuff"), "Body"));

        mockMvc.perform(get("/inbox/{id}", stuff.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(stuff.getId().toString()))
            .andExpect(jsonPath("$.title").value("Visible stuff"))
            .andExpect(jsonPath("$.body.text").value("Body"))
            .andExpect(jsonPath("$.status").value("STUFF"));
    }

    @Test
    void listsOnlyNonDeletedInboxStuff() throws Exception {
        Item visibleItem = itemRepository.save(new Item(new Title("Visible item"), null));
        Item deletedItem = itemRepository.save(new Item(new Title("Deleted item"), null));
        deletedItem.softDelete();
        itemRepository.save(deletedItem);

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(visibleItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Visible item"))
            .andExpect(jsonPath("$[0].status").value("STUFF"))
            .andExpect(jsonPath("$[0].createdAt", notNullValue()));
    }

    @Test
    void listsStuffOrderedByCreatedAtDescending() throws Exception {
        Item olderItem = saveItemCreatedAt("Older item", Instant.parse("2026-01-01T10:00:00Z"));
        Item newerItem = saveItemCreatedAt("Newer item", Instant.parse("2026-01-01T10:01:00Z"));

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(newerItem.getId().toString()))
            .andExpect(jsonPath("$[1].id").value(olderItem.getId().toString()));
    }

    @Test
    void listsOnlyDeletedInboxStuff() throws Exception {
        itemRepository.save(new Item(new Title("Visible item"), null));
        Item deletedItem = itemRepository.save(new Item(new Title("Deleted item"), null));
        deletedItem.softDelete();
        itemRepository.save(deletedItem);

        mockMvc.perform(get("/inbox/deleted"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(deletedItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Deleted item"))
            .andExpect(jsonPath("$[0].status").value("STUFF"))
            .andExpect(jsonPath("$[0].createdAt", notNullValue()));
    }

    @Test
    void listsDeletedStuffOrderedByUpdatedAtDescending() throws Exception {
        Item olderItem = saveItemCreatedAt("Older item", Instant.parse("2026-01-01T10:00:00Z"));
        Item newerItem = saveItemCreatedAt("Newer item", Instant.parse("2026-01-01T10:01:00Z"));
        olderItem.softDelete();
        itemRepository.save(olderItem);
        pauseForUpdateOrdering();
        newerItem.softDelete();
        itemRepository.save(newerItem);

        mockMvc.perform(get("/inbox/deleted"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(newerItem.getId().toString()))
            .andExpect(jsonPath("$[1].id").value(olderItem.getId().toString()));
    }

    private void pauseForUpdateOrdering() throws InterruptedException {
        Thread.sleep(5L);
    }

    @Test
    void convertsStuffToNextActionAndRemovesItFromInbox() throws Exception {
        Context context = contextRepository.save(new Context("office"));
        Item stuff = itemRepository.save(new Item(new Title("Call Ana"), null));

        mockMvc.perform(post("/inbox/{id}/next-action", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "energy": 4.5,
                      "estimatedTime": { "hours": 1, "minutes": 30 },
                      "contextIds": ["%s"]
                    }
                    """.formatted(context.getId())))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/{id}", stuff.getId()))
            .andExpect(status().isNotFound());
    }

    @Test
    void convertsStuffToAnywhereNextAction() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Call Ana"), null));

        mockMvc.perform(post("/inbox/{id}/next-action", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "energy": 4.5,
                      "estimatedTime": { "hours": 1, "minutes": 30 },
                      "contextIds": []
                    }
                    """))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/{id}", stuff.getId()))
            .andExpect(status().isNotFound());
    }

    @Test
    void rejectsConversionWithoutRequiredNextActionFields() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Call Ana"), null));

        mockMvc.perform(post("/inbox/{id}/next-action", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail", containsString("energy is required")))
            .andExpect(jsonPath("$.detail", containsString("estimatedTime is required")))
            .andExpect(jsonPath("$.detail", containsString("contextIds is required")));
    }

    @Test
    void convertsStuffToCalendarAndRemovesItFromInbox() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Pay rent"), null));

        mockMvc.perform(post("/inbox/{id}/calendar", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduledDate\":\"2026-05-21\",\"scheduledTime\":\"09:30\"}"))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/{id}", stuff.getId()))
            .andExpect(status().isNotFound());
    }

    @Test
    void rejectsCalendarConversionWithoutDate() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Pay rent"), null));

        mockMvc.perform(post("/inbox/{id}/calendar", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail", containsString("scheduledDate is required")));
    }

    @Test
    void rejectsCalendarConversionWithMalformedTime() throws Exception {
        Item stuff = itemRepository.save(new Item(new Title("Pay rent"), null));

        mockMvc.perform(post("/inbox/{id}/calendar", stuff.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduledDate\":\"2026-05-21\",\"scheduledTime\":\"9am\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail", containsString("scheduledTime value '9am' is invalid; expected HH:mm")));
    }

    @Test
    void allowsDesktopDevOrigin() throws Exception {
        mockMvc.perform(get("/inbox").header("Origin", "http://127.0.0.1:1420"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:1420"));
    }

    @Test
    void allowsDesktopDevOriginToPatchItems() throws Exception {
        mockMvc.perform(options("/items/00000000-0000-0000-0000-000000000001/title")
                .header("Origin", "http://127.0.0.1:1420")
                .header("Access-Control-Request-Method", "PATCH"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Methods", containsString("PATCH")));
    }

    private Item saveItemCreatedAt(String title, Instant createdAt) throws Exception {
        Item item = new Item(new Title(title), null);
        setAuditField(item, "createdAt", createdAt);
        setAuditField(item, "updatedAt", createdAt);
        return itemRepository.saveAndFlush(item);
    }

    private void setAuditField(Item item, String fieldName, Instant value) throws Exception {
        Field field = AuditableEntity.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(item, value);
    }
}
