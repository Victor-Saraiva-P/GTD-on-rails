package com.gtdonrails.api.controllers;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class MaintenanceCacheControllerTests {

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceCacheController(cacheInvalidationService)).build();
    }

    @Test
    void evictsAllCachesSuccessfully() throws Exception {
        mockMvc.perform(post("/maintenance/cache/evict"))
            .andExpect(status().isNoContent());

        verify(cacheInvalidationService).evictAll();
    }
}
