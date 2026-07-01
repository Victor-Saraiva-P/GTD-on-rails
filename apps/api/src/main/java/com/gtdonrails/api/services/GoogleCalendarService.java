package com.gtdonrails.api.services;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.CalendarListEntry;
import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.repositories.GoogleCredentialRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleCalendarService {

    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final ParameterizedTypeReference<Map<String, Object>> TOKEN_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
    };

    private final GoogleProperties googleProperties;
    private final GoogleCredentialRepository credentialRepository;
    private final GoogleCalendarRepository calendarRepository;
    private final GoogleClientCredentialsStore credentialsStore;
    private final RestTemplate restTemplate;

    public String buildAuthUrl(String redirectUri) {
        credentialsStore.loadConfiguredCredentials();
        return "https://accounts.google.com/o/oauth2/v2/auth?" +
                "client_id=" + googleProperties.getClientId() +
                "&redirect_uri=" + redirectUri +
                "&response_type=code" +
                "&scope=https://www.googleapis.com/auth/calendar" +
                "&access_type=offline" +
                "&prompt=consent";
    }

    @Transactional
    public void exchangeCodeForTokens(String code, String redirectUri) {
        credentialsStore.loadConfiguredCredentials();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", googleProperties.getClientId());
        body.add("client_secret", googleProperties.getClientSecret());
        body.add("code", code);
        body.add("grant_type", "authorization_code");
        body.add("redirect_uri", redirectUri);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map<String, Object>> response = tokenRequest(request);

        Map<String, Object> data = response.getBody();
        if (data != null && data.containsKey("access_token")) {
            GoogleCredential cred = credentialRepository.findAll().stream().findFirst().orElse(new GoogleCredential());
            cred.setAccessToken((String) data.get("access_token"));
            if (data.containsKey("refresh_token")) {
                cred.setRefreshToken((String) data.get("refresh_token"));
            }
            cred.setTokenType((String) data.get("token_type"));
            int expiresIn = ((Number) data.get("expires_in")).intValue();
            cred.setExpiresAt(Instant.now().plusSeconds(expiresIn));
            cred.setScope((String) data.get("scope"));
            
            credentialRepository.save(cred);
        }
    }

    @Transactional
    public GoogleCredential getValidCredential() {
        return getValidCredentialInCurrentTransaction();
    }

    private GoogleCredential getValidCredentialInCurrentTransaction() {
        Optional<GoogleCredential> opt = credentialRepository.findAll().stream().findFirst();
        if (opt.isEmpty()) return null;
        
        GoogleCredential cred = opt.get();
        if (credentialExpiresSoon(cred)) {
            return refreshAccessToken(cred);
        }
        return cred;
    }

    private boolean credentialExpiresSoon(GoogleCredential cred) {
        return cred.getExpiresAt() == null || cred.getExpiresAt().isBefore(Instant.now().plusSeconds(60));
    }

    private GoogleCredential refreshAccessToken(GoogleCredential cred) {
        credentialsStore.loadConfiguredCredentials();
        requireRefreshToken(cred);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", googleProperties.getClientId());
        body.add("client_secret", googleProperties.getClientSecret());
        body.add("refresh_token", cred.getRefreshToken());
        body.add("grant_type", "refresh_token");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map<String, Object>> response = tokenRequest(request);
            Map<String, Object> data = response.getBody();
            if (data != null && data.containsKey("access_token")) {
                cred.setAccessToken((String) data.get("access_token"));
                int expiresIn = ((Number) data.get("expires_in")).intValue();
                cred.setExpiresAt(Instant.now().plusSeconds(expiresIn));
                return credentialRepository.save(cred);
            }
        } catch (Exception e) {
            log.error("Failed to refresh token", e);
        }
        return cred;
    }

    private ResponseEntity<Map<String, Object>> tokenRequest(HttpEntity<MultiValueMap<String, String>> request) {
        return restTemplate.exchange(GOOGLE_TOKEN_URL, HttpMethod.POST, request, TOKEN_RESPONSE_TYPE);
    }

    private void requireRefreshToken(GoogleCredential cred) {
        if (StringUtils.hasText(cred.getRefreshToken())) return;
        log.error("Failed to refresh Google Calendar token: missing refresh token");
        throw new IllegalStateException("google refresh token value '" + cred.getRefreshToken() + "' is invalid; expected non-blank token");
    }

    public Calendar getCalendarClient() {
        GoogleCredential cred = getValidCredentialInCurrentTransaction();
        if (cred == null) throw new IllegalStateException("Not connected to Google Calendar");

        HttpRequestInitializer requestInitializer = request -> {
            request.getHeaders().setAuthorization("Bearer " + cred.getAccessToken());
        };

        return new Calendar.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer)
                .setApplicationName("GTD-on-Rails")
                .build();
    }

    @Transactional
    public void setupGtdCalendars() {
        Calendar client = getCalendarClient();
        try {
            List<CalendarListEntry> existing = client.calendarList().list().execute().getItems();
            
            createOrUpdateCalendar(client, existing, "Next Action", "#4F9768");
            createOrUpdateCalendar(client, existing, "Calendar", "#c85a53");
            createOrUpdateCalendar(client, existing, "On Going", "#2D8C8A");
            createOrUpdateCalendar(client, existing, "Done", "#7F8D3F");
            
        } catch (Exception e) {
            log.error("Failed to setup GTD calendars", e);
            throw new RuntimeException("Failed to setup calendars", e);
        }
    }

    @Transactional
    public void reconcileGtdCalendars() {
        setupGtdCalendars();
    }

    private void createOrUpdateCalendar(Calendar client, List<CalendarListEntry> existing, String name, String colorHex) throws Exception {
        GoogleCalendar dbCal = calendarRepository.findByName(name);
        Optional<CalendarListEntry> found = existing == null ? Optional.empty() : existing.stream().filter(c -> name.equals(c.getSummary())).findFirst();
        String googleCalendarId = null;
        boolean existsOnGoogle = false;
        
        if (dbCal != null) {
            String dbId = dbCal.getGoogleCalendarId();
            if (existing != null && existing.stream().anyMatch(c -> dbId.equals(c.getId()))) {
                googleCalendarId = dbId;
                existsOnGoogle = true;
            }
        }
        
        if (!existsOnGoogle && found.isPresent()) {
            googleCalendarId = found.get().getId();
            existsOnGoogle = true;
        }

        if (!existsOnGoogle) {
            com.google.api.services.calendar.model.Calendar newCal = new com.google.api.services.calendar.model.Calendar();
            newCal.setSummary(name);
            com.google.api.services.calendar.model.Calendar created = client.calendars().insert(newCal).execute();
            googleCalendarId = created.getId();
        }

        // Always ensure the calendar list entry has the exact requested color
        CalendarListEntry entry = new CalendarListEntry();
        entry.setId(googleCalendarId);
        entry.setBackgroundColor(colorHex);
        entry.setForegroundColor("#FFFFFF");
        client.calendarList().update(googleCalendarId, entry).setColorRgbFormat(true).execute();

        if (dbCal == null) {
            dbCal = new GoogleCalendar();
            dbCal.setName(name);
        }
        dbCal.setGoogleCalendarId(googleCalendarId);
        dbCal.setColorHex(colorHex);
        calendarRepository.save(dbCal);
    }

}
