package com.gtdonrails.api.controllers;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import com.gtdonrails.api.services.GoogleCalendarClientGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class GoogleCalendarControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @MockitoBean
    private GoogleCalendarClientGateway client;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void statusIsProxiedFromSyncClient() throws Exception {
        when(client.status()).thenReturn(Map.of(
            "credentialsConfigured", true,
            "configurationStatus", "READY",
            "configurationMessage", "ready",
            "connected", true,
            "calendars", List.of(Map.of(
                "name", "Next Action",
                "colorHex", "#4F9768",
                "googleCalendarId", "cal-id"
            ))
        ));

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credentialsConfigured").value(true))
            .andExpect(jsonPath("$.connected").value(true))
            .andExpect(jsonPath("$.calendars[0].googleCalendarId").value("cal-id"));
    }

    @Test
    void unavailableClientReturnsServiceUnavailableStatus() throws Exception {
        when(client.status()).thenThrow(new IllegalStateException("offline"));

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.configurationStatus").value("UNAVAILABLE"))
            .andExpect(jsonPath("$.connected").value(false));
    }

    @Test
    void credentialsAreStoredBySyncClient() throws Exception {
        mockMvc.perform(post("/integrations/google-calendar/credentials")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "clientId": "new-client",
                      "clientSecret": "new-secret"
                    }
                    """))
            .andExpect(status().isOk());

        verify(client).saveCredentials("new-client", "new-secret");
    }

    @Test
    void emptyCredentialsAreRejectedLocally() throws Exception {
        mockMvc.perform(post("/integrations/google-calendar/credentials")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "clientId": "new-client",
                      "clientSecret": ""
                    }
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    void authUrlIsReturnedFromSyncClient() throws Exception {
        when(client.authUrl()).thenReturn(Map.of("url", "http://127.0.0.1:9473/oauth/google/callback"));

        mockMvc.perform(post("/integrations/google-calendar/auth-url"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.url").value("http://127.0.0.1:9473/oauth/google/callback"));
    }

    @Test
    void reconcileIsExecutedBySyncClient() throws Exception {
        mockMvc.perform(post("/integrations/google-calendar/reconcile"))
            .andExpect(status().isOk());

        verify(client).reconcile();
    }

    @Test
    void reconcileReturnsUnavailableWhenClientCannotBeReached() throws Exception {
        doThrow(new IllegalStateException("offline")).when(client).reconcile();

        mockMvc.perform(post("/integrations/google-calendar/reconcile"))
            .andExpect(status().isServiceUnavailable());
    }
}
