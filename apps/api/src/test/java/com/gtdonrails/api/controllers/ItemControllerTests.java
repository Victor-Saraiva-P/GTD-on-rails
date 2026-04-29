package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;

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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class ItemControllerTests {

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
    void createsItem() throws Exception {
        ResultActions result = createItem("""
            {
              "title": "Capture rent receipt",
              "body": "Need to process later",
              "energy": 3.5,
              "time": {
                "hours": 1,
                "minutes": 45
              }
            }
            """);

        assertCreatedRentReceipt(result);
    }

    @Test
    void createsItemWithContexts() throws Exception {
        Context home = contextRepository.save(new Context("home"));
        Context street = contextRepository.save(new Context("street"));

        ResultActions result = createItem(itemWithContextsJson(home, street));

        assertCreatedItemWithContexts(result);
    }

    @Test
    void getsItem() throws Exception {
        Item item = itemRepository.save(new Item(
            new Title("Capture idea"),
            new Body("Need to process later"),
            energy("2.0"),
            Duration.ofMinutes(75)));

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()))
            .andExpect(jsonPath("$.title").value("Capture idea"))
            .andExpect(jsonPath("$.body").value("Need to process later"))
            .andExpect(jsonPath("$.energy").value(2.0))
            .andExpect(jsonPath("$.time.hours").value(1))
            .andExpect(jsonPath("$.time.minutes").value(15))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    @Test
    void createsItemWithNullEnergyWhenEnergyIsOmitted() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": "Need to process later"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.energy").value(nullValue()))
            .andExpect(jsonPath("$.time").value(nullValue()));
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        ResultActions result = createItem("""
            {
              "title": "   ",
              "body": "Need to process later",
              "energy": 1.0,
              "time": {
                "hours": 1,
                "minutes": 0
              }
            }
            """);

        assertBlankTitleError(result);
    }

    @Test
    void updatesItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), new Body("Old body"), energy("1.0"), Duration.ofMinutes(20)));

        ResultActions result = updateItem(item, """
            {
              "title": "New title",
              "body": "New body",
              "energy": 6.5,
              "time": {
                "hours": 2,
                "minutes": 5
              }
            }
            """);

        assertUpdatedItem(result);
    }

    @Test
    void updatesItemContexts() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Old title"), null, energy("1.0"), Duration.ofMinutes(15)));
        Context office = contextRepository.save(new Context("office"));

        ResultActions result = updateItem(item, updateWithContextJson(office));

        assertUpdatedItemContexts(result);
    }

    @Test
    void preservesExistingContextsWhenContextIdsAreOmittedOnUpdate() throws Exception {
        Context office = contextRepository.save(new Context("office"));
        Item item = itemRepository.save(new Item(new Title("Old title"), null, energy("2.0"), Duration.ofMinutes(80)));
        item.addContext(office);
        item = itemRepository.save(item);

        ResultActions result = updateItem(item, preserveContextsUpdateJson());

        assertPreservedContext(result);
    }

    @Test
    void rejectsTimeWhenMinutesExceedRange() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": "Need to process later",
                      "time": {
                        "hours": 1,
                        "minutes": 60
                      }
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString(
                "Field 'time.minutes': time.minutes must be less than or equal to 59")));
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

    private ResultActions createItem(String content) throws Exception {
        return mockMvc.perform(post("/items")
            .contentType(MediaType.APPLICATION_JSON)
            .content(content));
    }

    private ResultActions updateItem(Item item, String content) throws Exception {
        return mockMvc.perform(put("/items/{id}", item.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(content));
    }

    private String itemWithContextsJson(Context home, Context street) {
        return """
            {
              "title": "Capture rent receipt",
              "body": "Need to process later",
              "energy": 4.0,
              "time": { "hours": 0, "minutes": 30 },
              "contextIds": ["%s", "%s"]
            }
            """.formatted(home.getId(), street.getId());
    }

    private String updateWithContextJson(Context office) {
        return """
            {
              "title": "New title",
              "body": null,
              "energy": 5.0,
              "time": { "hours": 3, "minutes": 10 },
              "contextIds": ["%s"]
            }
            """.formatted(office.getId());
    }

    private String preserveContextsUpdateJson() {
        return """
            {
              "title": "Updated title",
              "body": "Updated body",
              "energy": 7.0,
              "time": { "hours": 1, "minutes": 20 }
            }
            """;
    }

    private void assertCreatedRentReceipt(ResultActions result) throws Exception {
        result.andExpect(status().isCreated())
            .andExpect(header().string("Location", "/items/" + itemRepository.findAll().getFirst().getId()))
            .andExpect(jsonPath("$.title").value("Capture rent receipt"))
            .andExpect(jsonPath("$.body").value("Need to process later"))
            .andExpect(jsonPath("$.energy").value(3.5))
            .andExpect(jsonPath("$.time.hours").value(1))
            .andExpect(jsonPath("$.time.minutes").value(45))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    private void assertCreatedItemWithContexts(ResultActions result) throws Exception {
        result.andExpect(status().isCreated())
            .andExpect(jsonPath("$.energy").value(4.0))
            .andExpect(jsonPath("$.time.hours").value(0))
            .andExpect(jsonPath("$.time.minutes").value(30))
            .andExpect(jsonPath("$.contexts", hasSize(2)))
            .andExpect(jsonPath("$.contexts[0].name").value("home"))
            .andExpect(jsonPath("$.contexts[1].name").value("street"));
    }

    private void assertBlankTitleError(ResultActions result) throws Exception {
        result.andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.title").value("Invalid data"))
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.type").value("https://gtdonrails.local/errors/invalid-data"))
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Field 'title': title is required")))
            .andExpect(jsonPath("$.instance").value("/items"));
    }

    private void assertUpdatedItem(ResultActions result) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body").value("New body"))
            .andExpect(jsonPath("$.energy").value(6.5))
            .andExpect(jsonPath("$.time.hours").value(2))
            .andExpect(jsonPath("$.time.minutes").value(5))
            .andExpect(jsonPath("$.createdAt", notNullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    private void assertUpdatedItemContexts(ResultActions result) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.energy").value(5.0))
            .andExpect(jsonPath("$.time.hours").value(3))
            .andExpect(jsonPath("$.time.minutes").value(10))
            .andExpect(jsonPath("$.contexts", hasSize(1)))
            .andExpect(jsonPath("$.contexts[0].name").value("office"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    private void assertPreservedContext(ResultActions result) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Updated title"))
            .andExpect(jsonPath("$.body").value("Updated body"))
            .andExpect(jsonPath("$.energy").value(7.0))
            .andExpect(jsonPath("$.time.hours").value(1))
            .andExpect(jsonPath("$.time.minutes").value(20))
            .andExpect(jsonPath("$.contexts", hasSize(1)))
            .andExpect(jsonPath("$.contexts[0].name").value("office"));
    }
}
