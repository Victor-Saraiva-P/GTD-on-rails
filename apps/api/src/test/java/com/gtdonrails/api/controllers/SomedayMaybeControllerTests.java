package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.gtdonrails.api.entities.Item;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class SomedayMaybeControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ProjectItemRepository projectItemRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private CacheInvalidationService cacheInvalidationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        projectItemRepository.deleteAll();
        projectRepository.deleteAll();
        itemRepository.deleteAll();
        cacheInvalidationService.evictAll();
    }

    @Test
    void listsActiveSomedayMaybeItems() throws Exception {
        Item item = new Item(new Title("Learn Japanese"), null);
        item.convertToSomedayMaybe();
        itemRepository.save(item);

        mockMvc.perform(get("/someday-maybe"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].title").value("Learn Japanese"))
            .andExpect(jsonPath("$[0].status").value("SOMEDAY_MAYBE"));
    }

    @Test
    void listsDeletedSomedayMaybeItems() throws Exception {
        Item item = new Item(new Title("Abandoned idea"), null);
        item.convertToSomedayMaybe();
        item.softDelete();
        itemRepository.save(item);

        mockMvc.perform(get("/someday-maybe/deleted"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].title").value("Abandoned idea"));
    }

    @Test
    void revertsSomedayMaybeToStuff() throws Exception {
        Item item = new Item(new Title("Start blog"), null);
        item.convertToSomedayMaybe();
        itemRepository.save(item);

        mockMvc.perform(post("/someday-maybe/{id}/stuff", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/someday-maybe"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(item.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Start blog"))
            .andExpect(jsonPath("$[0].status").value("STUFF"));
    }

    @Test
    void revertToStuffReturnsNotFoundForMissingItem() throws Exception {
        mockMvc.perform(post("/someday-maybe/{id}/stuff", UUID.randomUUID()))
            .andExpect(status().isNotFound());
    }
}
