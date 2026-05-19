package com.gtdonrails.api.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class AssetsControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ContextRepository contextRepository;

    @Autowired
    private ContextIconAssetRepository contextIconAssetRepository;

    @Autowired
    private ItemAssetRepository itemAssetRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        itemAssetRepository.deleteAll();
        itemRepository.deleteAll();
        contextIconAssetRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void uploadsItemAssetWithPublicUrl() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), null));
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", new byte[] {1, 2, 3});

        mockMvc.perform(multipart("/items/{id}/assets", item.getId()).file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.relativePath").value(org.hamcrest.Matchers.endsWith("/report.pdf")))
            .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.endsWith("/report.pdf")))
            .andExpect(jsonPath("$.contentType").value("application/pdf"));
    }

    @Test
    void copiesLocalItemAssetWithPublicUrl() throws Exception {
        Item item = itemRepository.save(new Item(new Title("Capture idea"), null));
        Path sourcePath = Files.createTempFile("local-item-asset", ".pdf");
        Files.write(sourcePath, new byte[] {1, 2, 3});

        mockMvc.perform(post("/items/{id}/assets/local-file", item.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sourcePath\":\"" + sourcePath + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.relativePath").value(org.hamcrest.Matchers.endsWith(sourcePath.getFileName().toString())))
            .andExpect(jsonPath("$.contentType").value("application/pdf"));

        Files.deleteIfExists(sourcePath);
    }
}
