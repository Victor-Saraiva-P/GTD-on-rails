package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
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
class ItemControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ContextRepository contextRepository;

    @Autowired
    private ItemAssetRepository itemAssetRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        itemAssetRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void createsStuffWithoutNextActionMetadata() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": {"text":"Receipt details","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Capture rent receipt"))
            .andExpect(jsonPath("$.body.text").value("Receipt details"))
            .andExpect(jsonPath("$.energy").value(nullValue()))
            .andExpect(jsonPath("$.estimatedTime").value(nullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)))
            .andExpect(jsonPath("$.status").value("STUFF"));
    }

    @Test
    void getsItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), "Details"));

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()))
            .andExpect(jsonPath("$.title").value("Capture idea"))
            .andExpect(jsonPath("$.body.text").value("Details"));
    }

    @Test
    void updatesItemTitleAndBody() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), "Old body"));

        mockMvc.perform(put("/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "New title",
                      "body": {"text":"New body","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body.text").value("New body"))
            .andExpect(jsonPath("$.energy").value(nullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void patchesTitleOnly() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), "Old body"));

        mockMvc.perform(patch("/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New title\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body.text").value("Old body"));
    }

    @Test
    void deletesAndRestoresItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), null));

        mockMvc.perform(delete("/items/{id}", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isNotFound());

        mockMvc.perform(post("/items/{id}/restore", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()));
    }
}
