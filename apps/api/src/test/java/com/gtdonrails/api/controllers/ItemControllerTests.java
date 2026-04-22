package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
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
class ItemControllerTests {

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
    void createsItem() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": "Need to process later"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/items/" + itemRepository.findAll().getFirst().getId()))
            .andExpect(jsonPath("$.title").value("Capture rent receipt"))
            .andExpect(jsonPath("$.body").value("Need to process later"))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void createsItemWithContexts() throws Exception {
        Context home = contextRepository.save(new Context("home"));
        Context street = contextRepository.save(new Context("street"));

        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": "Need to process later",
                      "contextIds": ["%s", "%s"]
                    }
                    """.formatted(home.getId(), street.getId())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.contexts", hasSize(2)))
            .andExpect(jsonPath("$.contexts[0].name").value("home"))
            .andExpect(jsonPath("$.contexts[1].name").value("street"));
    }

    @Test
    void getsItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), new Body("Need to process later")));

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()))
            .andExpect(jsonPath("$.title").value("Capture idea"))
            .andExpect(jsonPath("$.body").value("Need to process later"))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "   ",
                      "body": "Need to process later"
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.title").value("Invalid data"))
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Field 'title': title is required")))
            .andExpect(jsonPath("$.instance").value("/items"));
    }

    @Test
    void updatesItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), new Body("Old body")));

        mockMvc.perform(put("/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "New title",
                      "body": "New body"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body").value("New body"))
            .andExpect(jsonPath("$.createdAt", notNullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void updatesItemContexts() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), null));
        Context office = contextRepository.save(new Context("office"));

        mockMvc.perform(put("/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "New title",
                      "body": null,
                      "contextIds": ["%s"]
                    }
                    """.formatted(office.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contexts", hasSize(1)))
            .andExpect(jsonPath("$.contexts[0].name").value("office"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void preservesExistingContextsWhenContextIdsAreOmittedOnUpdate() throws Exception {
        Context office = contextRepository.save(new Context("office"));
        Item item = itemRepository.save(new Item(new Title("Old title"), null));
        item.addContext(office);
        item = itemRepository.save(item);

        mockMvc.perform(put("/items/{id}", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Updated title",
                      "body": "Updated body"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Updated title"))
            .andExpect(jsonPath("$.body").value("Updated body"))
            .andExpect(jsonPath("$.contexts", hasSize(1)))
            .andExpect(jsonPath("$.contexts[0].name").value("office"));
    }

    @Test
    void returnsNotFoundForMissingItem() throws Exception {
        mockMvc.perform(get("/items/00000000-0000-0000-0000-000000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Resource not found"))
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.detail").value("item not found"))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/resource-not-found"))
            .andExpect(jsonPath("$.instance").value("/items/00000000-0000-0000-0000-000000000001"));
    }

    @Test
    void returnsStandardizedNotFoundForUnknownRoute() throws Exception {
        mockMvc.perform(get("/route/that/does-not-exist"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Invalid URI"))
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-uri"))
            .andExpect(jsonPath("$.detail").value("The requested URI '/route/that/does-not-exist' does not exist. Correct it and try again."))
            .andExpect(jsonPath("$.instance").value("/route/that/does-not-exist"));
    }

    @Test
    void softDeletesItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Disposable item"), null));

        mockMvc.perform(delete("/items/{id}", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/inbox"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }
}
