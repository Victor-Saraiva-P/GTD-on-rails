package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:sqlite:./build/dev-demo-controller-test.db",
    "gtd.assets.local-directory=./build/dev-demo-controller-assets",
    "gtd.sync.rclone.enabled=false",
    "gtd.cleanup.enabled=false",
    "gtd.google.token-encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
})
@ActiveProfiles({"dev", "test"})
@Tag("integration")
class DevDemoDataControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AssetsProperties assetsProperties;

    @Autowired
    private GoogleCalendarRepository googleCalendarRepository;

    @Autowired
    private ItemAssetRepository itemAssetRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        googleCalendarRepository.deleteAll();
    }

    @Test
    void resetsDevelopmentDemoData() throws Exception {
        googleCalendarRepository.save(googleCalendar());

        mockMvc.perform(post("/dev/demo/reset"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.itemCount").value(27))
            .andExpect(jsonPath("$.contextCount").value(4));

        assertSeededDataVisible();
        assertPdfAssetCopied();
        assertEquals(1, googleCalendarRepository.count());
    }

    private void assertSeededDataVisible() throws Exception {
        mockMvc.perform(get("/contexts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(4)));
        mockMvc.perform(get("/next-actions").param("orderBy", "energy"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].title").value("Review Tauri architecture slides before Friday demo"))
            .andExpect(jsonPath("$[0].body.blockEntities[0].type").value("pdf"));
    }

    private void assertPdfAssetCopied() {
        Path assetDirectory = Path.of(assetsProperties.getLocalDirectory()).toAbsolutePath().normalize();
        boolean hasPdfFile = itemAssetRepository.findAll().stream()
            .anyMatch(asset -> Files.exists(assetDirectory.resolve(asset.relativePath())));
        assertTrue(hasPdfFile);
    }

    private GoogleCalendar googleCalendar() {
        GoogleCalendar calendar = new GoogleCalendar();
        calendar.setGoogleCalendarId("external-demo-calendar");
        calendar.setName("Calendar");
        calendar.setColorHex("#7F8D3F");
        return calendar;
    }
}
