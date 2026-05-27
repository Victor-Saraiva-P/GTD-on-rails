package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.services.GoogleCalendarService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class GoogleCalendarControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private GoogleCalendarRepository calendarRepository;

    @Autowired
    private GoogleProperties googleProperties;

    @MockitoBean
    private GoogleCalendarService googleCalendarService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        calendarRepository.deleteAll();
        googleProperties.setClientId(null);
        googleProperties.setClientSecret(null);
    }

    @Test
    void getStatusReturnsNotConfiguredInitially() throws Exception {
        when(googleCalendarService.getValidCredential()).thenReturn(null);

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credentialsConfigured").value(false))
            .andExpect(jsonPath("$.connected").value(false))
            .andExpect(jsonPath("$.calendars", hasSize(0)));
    }

    @Test
    void getStatusReturnsConnectedAndCalendarsWhenSetup() throws Exception {
        googleProperties.setClientId("client-id");
        
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("token");
        cred.setExpiresAt(Instant.now().plusSeconds(3600));
        when(googleCalendarService.getValidCredential()).thenReturn(cred);

        GoogleCalendar cal = new GoogleCalendar();
        cal.setName("Next Action");
        cal.setColorHex("#4F9768");
        cal.setGoogleCalendarId("cal-id");
        calendarRepository.save(cal);

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credentialsConfigured").value(true))
            .andExpect(jsonPath("$.connected").value(true))
            .andExpect(jsonPath("$.calendars", hasSize(1)))
            .andExpect(jsonPath("$.calendars[0].name").value("Next Action"))
            .andExpect(jsonPath("$.calendars[0].colorHex").value("#4F9768"));
    }

    @Test
    void saveCredentialsUpdatesProperties() throws Exception {
        mockMvc.perform(post("/integrations/google-calendar/credentials")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "clientId": "new-client",
                      "clientSecret": "new-secret"
                    }
                    """))
            .andExpect(status().isOk());

        assert googleProperties.getClientId().equals("new-client");
    }

    @Test
    void saveCredentialsRejectsEmptyPayload() throws Exception {
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
}
