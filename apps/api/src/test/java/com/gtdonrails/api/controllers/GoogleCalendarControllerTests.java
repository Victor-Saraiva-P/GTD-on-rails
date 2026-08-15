package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.GoogleCalendarService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${gtd.data.root-directory}")
    private String dataRoot;

    @MockitoBean
    private FileSyncService fileSyncService;

    @MockitoBean
    private GoogleCalendarService googleCalendarService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        calendarRepository.deleteAll();
        googleProperties.setClientId(null);
        googleProperties.setClientSecret(null);
        Files.deleteIfExists(googleCredentialsPath());
    }

    @Test
    void getStatusReturnsNotConfiguredInitially() throws Exception {
        when(googleCalendarService.getValidCredential()).thenReturn(null);

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credentialsConfigured").value(false))
            .andExpect(jsonPath("$.configurationStatus").value("MISSING"))
            .andExpect(jsonPath("$.connected").value(false))
            .andExpect(jsonPath("$.calendars", hasSize(0)));
    }

    @Test
    void getStatusReturnsConnectedAndCalendarsWhenSetup() throws Exception {
        googleProperties.setClientId("client-id");
        googleProperties.setClientSecret("client-secret");
        
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
            .andExpect(jsonPath("$.configurationStatus").value("READY"))
            .andExpect(jsonPath("$.connected").value(true))
            .andExpect(jsonPath("$.calendars", hasSize(1)))
            .andExpect(jsonPath("$.calendars[0].name").value("Next Action"))
            .andExpect(jsonPath("$.calendars[0].colorHex").value("#4F9768"));
    }

    @Test
    void getStatusLoadsPersistedCredentialsAfterRestart() throws Exception {
        writePersistedGoogleCredentials();
        when(googleCalendarService.getValidCredential()).thenReturn(null);

        mockMvc.perform(get("/integrations/google-calendar/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credentialsConfigured").value(true))
            .andExpect(jsonPath("$.connected").value(false));
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
        verify(fileSyncService).requestSync("integration credentials updated");
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

    @Test
    void oauthCallbackHidesExceptionDetails() throws Exception {
        googleProperties.setClientId("client-id");
        googleProperties.setClientSecret("client-secret");
        googleProperties.setTokenEncryptionKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        doThrow(new RuntimeException("secret-token-value"))
            .when(googleCalendarService).exchangeCodeForTokens(anyString(), anyString());

        mockMvc.perform(get("/oauth/google/callback").param("code", "oauth-code"))
            .andExpect(status().isInternalServerError())
            .andExpect(content().string(containsString("An unexpected error occurred")))
            .andExpect(content().string(not(containsString("secret-token-value"))));
    }

    @Test
    void oauthCallbackBlocksTokenExchangeWhenConfigurationIsNotReady() throws Exception {
        mockMvc.perform(get("/oauth/google/callback").param("code", "oauth-code"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(content().string(containsString("fix Google Calendar configuration first")));

        verify(googleCalendarService, never()).exchangeCodeForTokens(anyString(), anyString());
    }

    private void writePersistedGoogleCredentials() throws Exception {
        Files.createDirectories(googleCredentialsPath().getParent());
        Files.writeString(googleCredentialsPath(), """
            gtd.google.client-id=persisted-client
            gtd.google.client-secret=persisted-secret
            """);
    }

    private Path googleCredentialsPath() {
        return Path.of(dataRoot).resolve("google.properties");
    }
}
