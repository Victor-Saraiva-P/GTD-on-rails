package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.CalendarList;
import com.google.api.services.calendar.model.CalendarListEntry;
import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.repositories.GoogleCredentialRepository;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class GoogleCalendarServiceTests {

    @Mock
    private GoogleProperties googleProperties;

    @Mock
    private GoogleCredentialRepository credentialRepository;

    @Mock
    private GoogleCalendarRepository calendarRepository;

    @Mock
    private GoogleClientCredentialsStore credentialsStore;

    @Mock
    private RestTemplate restTemplate;

    private GoogleCalendarService service;

    @BeforeEach
    void setUp() {
        service = new GoogleCalendarService(
            googleProperties,
            credentialRepository,
            calendarRepository,
            credentialsStore,
            restTemplate);
    }

    @Test
    void buildAuthUrlUsesClientIdAndRedirectUri() {
        when(googleProperties.getClientId()).thenReturn("my-client-id");
        String url = service.buildAuthUrl("http://localhost/callback");
        assertTrue(url.contains("client_id=my-client-id"));
        assertTrue(url.contains("redirect_uri=http://localhost/callback"));
        assertTrue(url.contains("response_type=code"));
    }

    @Test
    void getValidCredentialReturnsNullWhenEmpty() {
        when(credentialRepository.findAll()).thenReturn(java.util.List.of());
        assertNull(service.getValidCredential());
    }

    @Test
    void getValidCredentialReturnsUnexpiredCredential() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("token");
        cred.setExpiresAt(Instant.now().plusSeconds(3600));
        when(credentialRepository.findAll()).thenReturn(java.util.List.of(cred));
        
        assertEquals(cred, service.getValidCredential());
    }

    @Test
    void getValidCredentialRefreshesWhenExpiresAtIsMissing() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("token");
        cred.setRefreshToken("refresh-token");
        when(credentialRepository.findAll()).thenReturn(List.of(cred));
        when(restTemplate.exchange(eq("https://oauth2.googleapis.com/token"), eq(HttpMethod.POST), any(), anyTokenResponseType()))
            .thenThrow(new RuntimeException("network disabled in unit test"));

        assertEquals(cred, service.getValidCredential());

        verify(restTemplate).exchange(eq("https://oauth2.googleapis.com/token"), eq(HttpMethod.POST), any(), anyTokenResponseType());
    }

    @Test
    void exchangeCodeForTokensSavesReturnedCredential() {
        when(googleProperties.getClientId()).thenReturn("client-id");
        when(googleProperties.getClientSecret()).thenReturn("client-secret");
        when(credentialRepository.findAll()).thenReturn(List.of());
        when(restTemplate.exchange(eq("https://oauth2.googleapis.com/token"), eq(HttpMethod.POST), any(), anyTokenResponseType()))
            .thenReturn(ResponseEntity.ok(tokenResponse("access-token", "refresh-token")));

        service.exchangeCodeForTokens("auth-code", "http://localhost/callback");

        GoogleCredential saved = savedCredential();
        assertEquals("access-token", saved.getAccessToken());
        assertEquals("refresh-token", saved.getRefreshToken());
        assertEquals("Bearer", saved.getTokenType());
        assertEquals("calendar-scope", saved.getScope());
    }

    @Test
    void getValidCredentialSavesRefreshedAccessToken() {
        GoogleCredential cred = expiredCredential("old-token", "refresh-token");
        when(credentialRepository.findAll()).thenReturn(List.of(cred));
        when(googleProperties.getClientId()).thenReturn("client-id");
        when(googleProperties.getClientSecret()).thenReturn("client-secret");
        when(credentialRepository.save(cred)).thenReturn(cred);
        when(restTemplate.exchange(eq("https://oauth2.googleapis.com/token"), eq(HttpMethod.POST), any(), anyTokenResponseType()))
            .thenReturn(ResponseEntity.ok(Map.of("access_token", "new-token", "expires_in", 3600)));

        GoogleCredential result = service.getValidCredential();

        assertSame(cred, result);
        assertEquals("new-token", cred.getAccessToken());
    }

    @Test
    void getCalendarClientRejectsMissingCredential() {
        when(credentialRepository.findAll()).thenReturn(List.of());

        IllegalStateException exception = assertThrows(IllegalStateException.class, service::getCalendarClient);

        assertEquals("Not connected to Google Calendar", exception.getMessage());
    }

    @Test
    void setupGtdCalendarsUpdatesExistingAndCreatesMissingCalendars() throws Exception {
        Calendar googleClient = mock(Calendar.class);
        TestableGoogleCalendarService calendarService = testableService(googleClient);
        stubCalendarList(googleClient, List.of(calendarEntry("next-id", "Next Action")));
        stubExistingCalendar("Next Action", "next-id");
        stubCalendarCreation(googleClient);
        stubCalendarColorUpdates(googleClient);

        calendarService.setupGtdCalendars();

        verify(calendarRepository).save(namedCalendar("Next Action", "next-id", "#4F9768"));
        verify(calendarRepository).save(namedCalendar("Calendar", "created-Calendar", "#c85a53"));
        verify(calendarRepository).save(namedCalendar("On Going", "created-On Going", "#9B5AB7"));
        verify(calendarRepository).save(namedCalendar("Done", "created-Done", "#7F8D3F"));
    }

    @Test
    void getValidCredentialRejectsMissingRefreshToken() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("expired-token");
        cred.setExpiresAt(Instant.now().minusSeconds(60));
        when(credentialRepository.findAll()).thenReturn(List.of(cred));

        IllegalStateException exception = assertThrows(IllegalStateException.class, service::getValidCredential);

        assertEquals("google refresh token value 'null' is invalid; expected non-blank token", exception.getMessage());
        verifyNoInteractions(restTemplate);
        verify(credentialRepository).findAll();
        verifyNoMoreInteractions(credentialRepository);
    }

    @Test
    void getValidCredentialRejectsBlankRefreshToken() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("expired-token");
        cred.setRefreshToken(" ");
        cred.setExpiresAt(Instant.now().minusSeconds(60));
        when(credentialRepository.findAll()).thenReturn(List.of(cred));

        IllegalStateException exception = assertThrows(IllegalStateException.class, service::getValidCredential);

        assertEquals("google refresh token value ' ' is invalid; expected non-blank token", exception.getMessage());
        verifyNoInteractions(restTemplate);
        verify(credentialRepository).findAll();
        verifyNoMoreInteractions(credentialRepository);
    }

    private ParameterizedTypeReference<java.util.Map<String, Object>> anyTokenResponseType() {
        return any();
    }

    private Map<String, Object> tokenResponse(String accessToken, String refreshToken) {
        return Map.of(
            "access_token", accessToken,
            "refresh_token", refreshToken,
            "token_type", "Bearer",
            "expires_in", 3600,
            "scope", "calendar-scope");
    }

    private GoogleCredential savedCredential() {
        ArgumentCaptor<GoogleCredential> captor = ArgumentCaptor.forClass(GoogleCredential.class);
        verify(credentialRepository).save(captor.capture());
        return captor.getValue();
    }

    private GoogleCredential expiredCredential(String accessToken, String refreshToken) {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken(accessToken);
        cred.setRefreshToken(refreshToken);
        cred.setExpiresAt(Instant.now().minusSeconds(60));
        return cred;
    }

    private TestableGoogleCalendarService testableService(Calendar googleClient) {
        return new TestableGoogleCalendarService(
            googleProperties,
            credentialRepository,
            calendarRepository,
            credentialsStore,
            restTemplate,
            googleClient);
    }

    private void stubCalendarList(Calendar client, List<CalendarListEntry> entries) throws Exception {
        Calendar.CalendarList calendarList = mock(Calendar.CalendarList.class);
        Calendar.CalendarList.List listRequest = mock(Calendar.CalendarList.List.class);
        when(client.calendarList()).thenReturn(calendarList);
        when(calendarList.list()).thenReturn(listRequest);
        when(listRequest.execute()).thenReturn(new CalendarList().setItems(entries));
    }

    private CalendarListEntry calendarEntry(String id, String summary) {
        return new CalendarListEntry().setId(id).setSummary(summary);
    }

    private void stubExistingCalendar(String name, String googleCalendarId) {
        GoogleCalendar calendar = new GoogleCalendar();
        calendar.setName(name);
        calendar.setGoogleCalendarId(googleCalendarId);
        when(calendarRepository.findByName(name)).thenReturn(calendar);
    }

    private void stubCalendarCreation(Calendar client) throws Exception {
        Calendar.Calendars calendars = mock(Calendar.Calendars.class);
        when(client.calendars()).thenReturn(calendars);
        stubCreatedCalendar(calendars, "Calendar");
        stubCreatedCalendar(calendars, "On Going");
        stubCreatedCalendar(calendars, "Done");
    }

    private void stubCreatedCalendar(Calendar.Calendars calendars, String name) throws Exception {
        Calendar.Calendars.Insert insertRequest = mock(Calendar.Calendars.Insert.class);
        when(calendars.insert(calendarSummary(name))).thenReturn(insertRequest);
        when(insertRequest.execute()).thenReturn(new com.google.api.services.calendar.model.Calendar().setId("created-" + name));
    }

    private com.google.api.services.calendar.model.Calendar calendarSummary(String name) {
        return org.mockito.ArgumentMatchers.argThat(calendar -> calendar != null && name.equals(calendar.getSummary()));
    }

    private void stubCalendarColorUpdates(Calendar client) throws Exception {
        Calendar.CalendarList calendarList = client.calendarList();
        stubCalendarColorUpdate(calendarList, "next-id");
        stubCalendarColorUpdate(calendarList, "created-Calendar");
        stubCalendarColorUpdate(calendarList, "created-On Going");
        stubCalendarColorUpdate(calendarList, "created-Done");
    }

    private void stubCalendarColorUpdate(Calendar.CalendarList calendarList, String calendarId) throws Exception {
        Calendar.CalendarList.Update updateRequest = mock(Calendar.CalendarList.Update.class);
        when(calendarList.update(eq(calendarId), any(CalendarListEntry.class))).thenReturn(updateRequest);
        when(updateRequest.setColorRgbFormat(true)).thenReturn(updateRequest);
    }

    private GoogleCalendar namedCalendar(String name, String googleCalendarId, String colorHex) {
        return org.mockito.ArgumentMatchers.argThat(calendar -> calendarMatches(calendar, name, googleCalendarId, colorHex));
    }

    private boolean calendarMatches(GoogleCalendar calendar, String name, String googleCalendarId, String colorHex) {
        Assertions.assertNotNull(calendar);
        return name.equals(calendar.getName())
            && googleCalendarId.equals(calendar.getGoogleCalendarId())
            && colorHex.equals(calendar.getColorHex());
    }

    private static class TestableGoogleCalendarService extends GoogleCalendarService {

        private final Calendar googleClient;

        TestableGoogleCalendarService(
            GoogleProperties googleProperties,
            GoogleCredentialRepository credentialRepository,
            GoogleCalendarRepository calendarRepository,
            GoogleClientCredentialsStore credentialsStore,
            RestTemplate restTemplate,
            Calendar googleClient
        ) {
            super(googleProperties, credentialRepository, calendarRepository, credentialsStore, restTemplate);
            this.googleClient = googleClient;
        }

        @Override
        public Calendar getCalendarClient() {
            return googleClient;
        }
    }
}
