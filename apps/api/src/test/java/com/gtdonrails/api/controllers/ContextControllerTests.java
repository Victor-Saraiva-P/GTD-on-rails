package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class ContextControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ContextRepository contextRepository;

    @Autowired
    private ItemRepository itemRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void createsContext() throws Exception {
        mockMvc.perform(post("/contexts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "home"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/contexts/" + contextRepository.findAll().getFirst().getId()))
            .andExpect(jsonPath("$.name").value("home"));
    }

    @Test
    void allowsDuplicateContextName() throws Exception {
        contextRepository.save(new Context("home"));

        mockMvc.perform(post("/contexts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "home"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("home"));

        mockMvc.perform(get("/contexts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void listsOnlyNonDeletedContexts() throws Exception {
        Context visibleContext = contextRepository.save(new Context("home"));
        Context deletedContext = contextRepository.save(new Context("street"));
        deletedContext.softDelete();
        contextRepository.save(deletedContext);

        mockMvc.perform(get("/contexts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(visibleContext.getId().toString()))
            .andExpect(jsonPath("$[0].name").value("home"));
    }

    @Test
    void getsContext() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        mockMvc.perform(get("/contexts/{id}", context.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(context.getId().toString()))
            .andExpect(jsonPath("$.name").value("home"));
    }

    @Test
    void updatesContext() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        mockMvc.perform(put("/contexts/{id}", context.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "office"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("office"));
    }

    @Test
    void uploadsContextIcon() throws Exception {
        Context context = contextRepository.save(new Context("home"));
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "home.png",
            "image/png",
            new byte[] {1, 2, 3}
        );

        mockMvc.perform(multipart("/contexts/{id}/icon", context.getId())
                .file(file)
                .with(request -> {
                    request.setMethod("PUT");
                    return request;
                }))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.iconUrl").value("/assets/contexts/" + context.getId() + "/icon.png"));

        mockMvc.perform(get("/assets/contexts/{id}/icon.png", context.getId()))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "image/png"));
    }

    @Test
    void rejectsInvalidContextIconType() throws Exception {
        Context context = contextRepository.save(new Context("home"));
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "home.txt",
            MediaType.TEXT_PLAIN_VALUE,
            "not an icon".getBytes()
        );

        mockMvc.perform(multipart("/contexts/{id}/icon", context.getId())
                .file(file)
                .with(request -> {
                    request.setMethod("PUT");
                    return request;
                }))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("icon file must be PNG, SVG or WebP"));
    }

    @Test
    void deletesContextIcon() throws Exception {
        Context context = new Context("home");
        context.setIconAssetPath("contexts/00000000-0000-0000-0000-000000000001/icon.png");
        context = contextRepository.save(context);

        mockMvc.perform(delete("/contexts/{id}/icon", context.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.iconUrl").doesNotExist());
    }

    @Test
    void returnsNotFoundForMissingContext() throws Exception {
        mockMvc.perform(get("/contexts/00000000-0000-0000-0000-000000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Resource not found"))
            .andExpect(jsonPath("$.detail").value("context not found"));
    }

    @Test
    void softDeletesContext() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        mockMvc.perform(delete("/contexts/{id}", context.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/contexts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void deletingContextRemovesItFromRelatedItems() throws Exception {
        Context context = contextRepository.save(new Context("home"));
        Item item = new Item(new Title("Capture idea"), null);
        item.addContext(context);
        item = itemRepository.saveAndFlush(item);

        mockMvc.perform(delete("/contexts/{id}", context.getId()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/items/{id}", item.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contexts", hasSize(0)));
    }

    @Test
    void listsItemsForContextOrderedByMostRecentlyUpdatedFirst() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        Item oldest = new Item(new Title("Oldest item"), null);
        oldest.addContext(context);
        itemRepository.saveAndFlush(oldest);

        Thread.sleep(5);

        Item middle = new Item(new Title("Middle item"), null);
        middle.addContext(context);
        itemRepository.saveAndFlush(middle);

        Thread.sleep(5);

        Item newest = new Item(new Title("Newest item"), null);
        newest.addContext(context);
        itemRepository.saveAndFlush(newest);

        mockMvc.perform(get("/contexts/{id}/items", context.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(3)))
            .andExpect(jsonPath("$[0].id").value(newest.getId().toString()))
            .andExpect(jsonPath("$[0].status").value("STUFF"))
            .andExpect(jsonPath("$[0].body").doesNotExist())
            .andExpect(jsonPath("$[0].title").value("Newest item"))
            .andExpect(jsonPath("$[1].title").value("Middle item"))
            .andExpect(jsonPath("$[2].title").value("Oldest item"));
    }

    @Test
    void listsOnlyLimitedNumberOfItemsForContext() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        Item older = new Item(new Title("Older item"), null);
        older.addContext(context);
        itemRepository.saveAndFlush(older);

        Thread.sleep(5);

        Item newer = new Item(new Title("Newer item"), null);
        newer.addContext(context);
        itemRepository.saveAndFlush(newer);

        mockMvc.perform(get("/contexts/{id}/items", context.getId())
                .param("limit", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].title").value("Newer item"));
    }

    @Test
    void returnsNotFoundWhenListingItemsForMissingContext() throws Exception {
        mockMvc.perform(get("/contexts/00000000-0000-0000-0000-000000000001/items"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Resource not found"))
            .andExpect(jsonPath("$.detail").value("context not found"));
    }

    @Test
    void returnsBadRequestWhenLimitIsNotPositive() throws Exception {
        Context context = contextRepository.save(new Context("home"));

        mockMvc.perform(get("/contexts/{id}/items", context.getId())
                .param("limit", "0"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("limit must be greater than 0"));
    }
}
