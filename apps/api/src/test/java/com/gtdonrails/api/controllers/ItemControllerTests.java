package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import com.gtdonrails.api.services.CacheInvalidationService;
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

    @Autowired
    private CacheInvalidationService cacheInvalidationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        cacheInvalidationService.evictAll();
        itemAssetRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void removedGenericItemEndpointsAreNotMapped() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), null));

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(post("/items").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isNotFound());
        mockMvc.perform(patch("/items/{id}", item.getId()).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void patchesItemTitleOnly() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), "Old body"));

        mockMvc.perform(patch("/items/{id}/title", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" New title \"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body.text").value("Old body"));
    }

    @Test
    void patchesItemBodyOnly() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), "Old body"));

        mockMvc.perform(patch("/items/{id}/body", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "body": {"text":"New body","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Old title"))
            .andExpect(jsonPath("$.body.text").value("New body"))
            .andExpect(jsonPath("$.energy").value(nullValue()));
    }

    @Test
    void deletesAndRestoresItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), null));

        mockMvc.perform(delete("/items/{id}", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/{id}", item.getId()))
            .andExpect(status().isNotFound());

        mockMvc.perform(post("/items/{id}/restore", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()));
    }
}
