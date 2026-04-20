package com.gtdonrails.api.inbox;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.controllers.InboxController;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.services.InboxService;
import com.gtdonrails.api.types.Body;
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

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        itemRepository.deleteAll();
    }

    @Test
    void createsInboxItem() throws Exception {
        mockMvc.perform(post("/inbox/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": "Need to process later"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/inbox/items/" + itemRepository.findAll().getFirst().getId()))
            .andExpect(jsonPath("$.title").value("Capture rent receipt"))
            .andExpect(jsonPath("$.body").value("Need to process later"))
            .andExpect(jsonPath("$.status").value("STUFF"));
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        mockMvc.perform(post("/inbox/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "   ",
                      "body": "Need to process later"
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("title is required"));
    }

    @Test
    void listsOnlyNonDeletedInboxItems() throws Exception {
        Item visibleItem = itemRepository.save(new Item(new Title("Visible item"), null));
        Item deletedItem = itemRepository.save(new Item(new Title("Deleted item"), null));
        deletedItem.softDelete();
        itemRepository.save(deletedItem);

        mockMvc.perform(get("/inbox/items"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(visibleItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Visible item"));
    }

    @Test
    void listsStuffOrderedByCreatedAtDescending() throws Exception {
        Item olderItem = itemRepository.saveAndFlush(new Item(new Title("Older item"), null));
        Thread.sleep(5);
        Item newerItem = itemRepository.saveAndFlush(new Item(new Title("Newer item"), null));

        mockMvc.perform(get("/inbox/items"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(newerItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Newer item"))
            .andExpect(jsonPath("$[1].id").value(olderItem.getId().toString()))
            .andExpect(jsonPath("$[1].title").value("Older item"));
    }

    @Test
    void updatesInboxItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), new Body("Old body")));

        mockMvc.perform(put("/inbox/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "New title",
                      "body": "New body"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body").value("New body"));
    }

    @Test
    void returnsNotFoundForMissingInboxItem() throws Exception {
        mockMvc.perform(get("/inbox/items/00000000-0000-0000-0000-000000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("inbox item not found"));
    }

    @Test
    void softDeletesInboxItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Disposable item"), null));

        mockMvc.perform(delete("/inbox/items/{id}", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/items"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }
}
