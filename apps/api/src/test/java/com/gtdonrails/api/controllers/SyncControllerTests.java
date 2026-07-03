package com.gtdonrails.api.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class SyncControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void reportsCombinedSyncStatus() throws Exception {
        mockMvc.perform(get("/sync/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.state").value("DISABLED"))
            .andExpect(jsonPath("$.googleCalendar.state").exists())
            .andExpect(jsonPath("$.persistence").doesNotExist())
            .andExpect(jsonPath("$.assets").doesNotExist());
    }

    @Test
    void removesAssetSyncStatusEndpoint() throws Exception {
        mockMvc.perform(get("/assets/sync/status"))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void acceptsManualDataSyncRequest() throws Exception {
        mockMvc.perform(post("/sync/data"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.state").value("DISABLED"));
    }
}
