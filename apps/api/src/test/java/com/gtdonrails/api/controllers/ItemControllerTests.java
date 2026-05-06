package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
    void createsItem() throws Exception {
        ResultActions result = createItem("""
            {
              "title": "Capture rent receipt",
              "body": %s,
              "energy": 3.5,
              "time": {
                "hours": 1,
                "minutes": 45
              }
            }
            """.formatted(bodyJson("Need to process later")));

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
    void createsItemWithOnlyTitle() throws Exception {
        createItem("""
            {
              "title": "Quick capture"
            }
            """)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Quick capture"))
            .andExpect(jsonPath("$.body.text").value(""))
            .andExpect(jsonPath("$.energy").value(nullValue()))
            .andExpect(jsonPath("$.time").value(nullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void getsItem() throws Exception {
        Item item = savedTimedItem("Capture idea", "Need to process later", "2.0", 75);

        ResultActions result = mockMvc.perform(get("/items/{id}", item.getId()));

        assertFetchedItem(result, item);
    }

    @Test
    void createsItemWithNullEnergyWhenEnergyIsOmitted() throws Exception {
        mockMvc.perform(post("/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Capture rent receipt",
                      "body": %s
                    }
                    """.formatted(bodyJson("Need to process later"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.energy").value(nullValue()))
            .andExpect(jsonPath("$.time").value(nullValue()));
    }

    @Test
    void createsItemWithNullBodyAsEmptyBody() throws Exception {
        createItem("""
            {
              "title": "Capture empty body",
              "body": null
            }
            """)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.body.text").value(""))
            .andExpect(jsonPath("$.body.inlineMarks", hasSize(0)))
            .andExpect(jsonPath("$.body.lineBlocks", hasSize(0)))
            .andExpect(jsonPath("$.body.blockEntities", hasSize(0)));
    }

    @Test
    void createsItemWithStructuredBody() throws Exception {
        createItem("""
            {
              "title": "Capture rich body",
              "body": {
                "text": null,
                "inlineMarks": null,
                "lineBlocks": null,
                "blockEntities": null
              }
            }
            """)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.body.text").value(""))
            .andExpect(jsonPath("$.body.inlineMarks", hasSize(0)))
            .andExpect(jsonPath("$.body.lineBlocks", hasSize(0)))
            .andExpect(jsonPath("$.body.blockEntities", hasSize(0)));
    }

    @Test
    void persistsStructuredBodyMetadata() throws Exception {
        String body = """
            {
              "text": "see ⟦asset:asset_id⟧",
              "inlineMarks": [{"id":"m1","type":"bold","from":0,"to":3}],
              "lineBlocks": [{"id":"l1","type":"paragraph","from":0,"to":22}],
              "blockEntities": []
            }
            """;

        createItem("""
            {
              "title": "Capture asset token",
              "body": %s
            }
            """.formatted(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.body.text").value("see ⟦asset:asset_id⟧"))
            .andExpect(jsonPath("$.body.inlineMarks[0].id").value("m1"))
            .andExpect(jsonPath("$.body.lineBlocks[0].id").value("l1"))
            .andExpect(jsonPath("$.body.blockEntities", hasSize(0)));
    }

    @Test
    void rejectsCreateWithBlockEntityBeforeAssetUpload() throws Exception {
        createItem("""
            {
              "title": "Capture asset token",
              "body": {
                "text": "see ⟦asset:asset_id⟧",
                "blockEntities": [{"id":"b1","type":"pdf","from":4,"to":22,"assetId":"asset_id"}]
              }
            }
            """)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("body.blockEntities value is invalid; expected uploaded assets on an existing item"));
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        ResultActions result = createItem("""
            {
              "title": "   ",
              "body": %s,
              "energy": 1.0,
              "time": {
                "hours": 1,
                "minutes": 0
              }
            }
            """.formatted(bodyJson("Need to process later")));

        assertBlankTitleError(result);
    }

    @Test
    void updatesItem() throws Exception {
        Item item = savedTimedItem("Old title", "Old body", "1.0", 20);

        ResultActions result = updateItem(item, updateItemJson());

        assertUpdatedItem(result);
    }

    @Test
    void patchesOnlyItemBody() throws Exception {
        Item item = savedTimedItem("Old title", "Old body", "1.0", 20);

        patchItemBody(item, """
            {
              "body": %s
            }
            """.formatted(bodyJson("New body only")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Old title"))
            .andExpect(jsonPath("$.body.text").value("New body only"))
            .andExpect(jsonPath("$.energy").value(1.0))
            .andExpect(jsonPath("$.time.minutes").value(20));
    }

    @Test
    void patchesMetadataAndPreservesOmittedContexts() throws Exception {
        Context office = contextRepository.save(new Context("office"));
        Item item = savedTimedItem("Old title", "Old body", "1.0", 20);
        item.addContext(office);
        item = itemRepository.save(item);

        patchItem(item, """
            {
              "energy": 4.5
            }
            """)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Old title"))
            .andExpect(jsonPath("$.body.text").value("Old body"))
            .andExpect(jsonPath("$.energy").value(4.5))
            .andExpect(jsonPath("$.time.minutes").value(20))
            .andExpect(jsonPath("$.contexts", hasSize(1)));
    }

    @Test
    void patchesMetadataAndClearsContextsWithEmptyArray() throws Exception {
        Context office = contextRepository.save(new Context("office"));
        Item item = itemRepository.save(new Item(new Title("Old title"), null));
        item.addContext(office);
        item = itemRepository.save(item);

        patchItem(item, """
            {
              "contextIds": []
            }
            """)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void normalizesMarkdownBodyLineEndings() throws Exception {
        ResultActions result = createItem("""
            {
              "title": "Capture markdown",
              "body": %s
            }
            """.formatted(bodyJson("  # Title\r\n\n- item  ")));

        result.andExpect(status().isCreated())
            .andExpect(jsonPath("$.body.text").value("  # Title\n\n- item  "));
    }

    @Test
    void storesMaliciousBodyAsText() throws Exception {
        String maliciousBody = "<script>alert(1)</script>\n[jump](javascript:alert(1))";

        ResultActions result = createItem("""
            {
              "title": "Capture suspicious markdown",
              "body": %s
            }
            """.formatted(bodyJson(maliciousBody)));

        result.andExpect(status().isCreated())
            .andExpect(jsonPath("$.body.text").value(maliciousBody));
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
                      "body": %s,
                      "time": {
                        "hours": 1,
                        "minutes": 60
                      }
                    }
                    """.formatted(bodyJson("Need to process later"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString(
                "Field 'time.minutes' value '60': time.minutes must be less than or equal to 59")));
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

    @Test
    void restoresItem() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Restore me"), null));
        item.softDelete();
        itemRepository.save(item);

        mockMvc.perform(post("/items/{id}/restore", item.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()));
    }

    @Test
    void uploadsItemAsset() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Asset item"), null));
        MockMultipartFile file = new MockMultipartFile("file", "file.pdf", "application/pdf", new byte[] {1, 2, 3});

        mockMvc.perform(multipart("/items/{id}/assets", item.getId()).file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(notNullValue()))
            .andExpect(jsonPath("$.relativePath").value(org.hamcrest.Matchers.matchesPattern("items/" + item.getId() + "/[0-9a-f-]+/file\\.pdf")))
            .andExpect(jsonPath("$.url").doesNotExist())
            .andExpect(jsonPath("$.fileName").value("file.pdf"))
            .andExpect(jsonPath("$.contentType").value("application/pdf"))
            .andExpect(jsonPath("$.image").value(false));
        org.junit.jupiter.api.Assertions.assertEquals(1, itemAssetRepository.findAllByItemId(item.getId()).size());
    }

    @Test
    void returnsNotFoundWhenRestoringMissingItem() throws Exception {
        mockMvc.perform(post("/items/00000000-0000-0000-0000-000000000001/restore"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail").value("item not found"));
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

    private ResultActions patchItem(Item item, String content) throws Exception {
        return mockMvc.perform(patch("/items/{id}", item.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(content));
    }

    private ResultActions patchItemBody(Item item, String content) throws Exception {
        return mockMvc.perform(patch("/items/{id}/body", item.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(content));
    }

    private Item savedTimedItem(String title, String body, String energyValue, long minutes) {
        return itemRepository.save(new Item(
            new Title(title),
            body,
            energy(energyValue),
            Duration.ofMinutes(minutes)));
    }

    private String updateItemJson() {
        return """
            {
              "title": "New title",
              "body": %s,
              "energy": 6.5,
              "time": { "hours": 2, "minutes": 5 }
            }
            """.formatted(bodyJson("New body"));
    }

    private String itemWithContextsJson(Context home, Context street) {
        return """
            {
              "title": "Capture rent receipt",
              "body": %s,
              "energy": 4.0,
              "time": { "hours": 0, "minutes": 30 },
              "contextIds": ["%s", "%s"]
            }
            """.formatted(bodyJson("Need to process later"), home.getId(), street.getId());
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
              "body": %s,
              "energy": 7.0,
              "time": { "hours": 1, "minutes": 20 }
            }
            """.formatted(bodyJson("Updated body"));
    }

    private String bodyJson(String text) {
        return "{\"text\":\"" + text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\r", "\\r")
            .replace("\n", "\\n")
            + "\",\"inlineMarks\":[],\"lineBlocks\":[],\"blockEntities\":[]}";
    }

    private void assertFetchedItem(ResultActions result, Item item) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(item.getId().toString()))
            .andExpect(jsonPath("$.title").value("Capture idea"))
            .andExpect(jsonPath("$.body.text").value("Need to process later"))
            .andExpect(jsonPath("$.energy").value(2.0))
            .andExpect(jsonPath("$.time.hours").value(1))
            .andExpect(jsonPath("$.time.minutes").value(15))
            .andExpect(jsonPath("$.status").value("STUFF"))
            .andExpect(jsonPath("$.createdAt", notNullValue()));
    }

    private void assertCreatedRentReceipt(ResultActions result) throws Exception {
        result.andExpect(status().isCreated())
            .andExpect(header().string("Location", "/items/" + itemRepository.findAll().getFirst().getId()))
            .andExpect(jsonPath("$.title").value("Capture rent receipt"))
            .andExpect(jsonPath("$.body.text").value("Need to process later"))
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
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString(
                "Field 'title' value '   ': expected non-blank text")))
            .andExpect(jsonPath("$.instance").value("/items"));
    }

    private void assertUpdatedItem(ResultActions result) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("New title"))
            .andExpect(jsonPath("$.body.text").value("New body"))
            .andExpect(jsonPath("$.energy").value(6.5))
            .andExpect(jsonPath("$.time.hours").value(2))
            .andExpect(jsonPath("$.time.minutes").value(5))
            .andExpect(jsonPath("$.createdAt", notNullValue()))
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    private void assertUpdatedItemContexts(ResultActions result) throws Exception {
        result.andExpect(status().isOk())
            .andExpect(jsonPath("$.body.text").value(""))
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
            .andExpect(jsonPath("$.body.text").value("Updated body"))
            .andExpect(jsonPath("$.energy").value(7.0))
            .andExpect(jsonPath("$.time.hours").value(1))
            .andExpect(jsonPath("$.time.minutes").value(20))
            .andExpect(jsonPath("$.contexts", hasSize(1)))
            .andExpect(jsonPath("$.contexts[0].name").value("office"));
    }
}
