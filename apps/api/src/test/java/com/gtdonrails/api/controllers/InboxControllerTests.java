package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
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
class InboxControllerTests {

    private static BigDecimal energy(String value) {
        return new BigDecimal(value);
    }

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
    void listsOnlyNonDeletedInboxItems() throws Exception {
        Item visibleItem = itemRepository.save(new Item(new Title("Visible item"), null, energy("1.0")));
        Item deletedItem = itemRepository.save(new Item(new Title("Deleted item"), null, energy("2.0")));
        deletedItem.softDelete();
        itemRepository.save(deletedItem);

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(visibleItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Visible item"))
            .andExpect(jsonPath("$[0].energy").value(1.0))
            .andExpect(jsonPath("$[0].createdAt", notNullValue()));
    }

    @Test
    void listsStuffOrderedByCreatedAtDescending() throws Exception {
        Item olderItem = itemRepository.saveAndFlush(new Item(new Title("Older item"), null, energy("1.0")));
        Thread.sleep(5);
        Item newerItem = itemRepository.saveAndFlush(new Item(new Title("Newer item"), null, energy("2.0")));

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].id").value(newerItem.getId().toString()))
            .andExpect(jsonPath("$[0].title").value("Newer item"))
            .andExpect(jsonPath("$[0].energy").value(2.0))
            .andExpect(jsonPath("$[1].id").value(olderItem.getId().toString()))
            .andExpect(jsonPath("$[1].title").value("Older item"))
            .andExpect(jsonPath("$[1].energy").value(1.0));
    }

    @Test
    void allowsDesktopDevOrigin() throws Exception {
        mockMvc.perform(get("/inbox").header("Origin", "http://127.0.0.1:1420"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:1420"));
    }
}
