package com.gtdonrails.api.controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.util.StringUtils;

import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.services.GoogleClientCredentialsStore;
import com.gtdonrails.api.services.GoogleCalendarService;
import com.gtdonrails.api.services.GoogleIntegrationConfigurationHealth;
import com.gtdonrails.api.services.GoogleIntegrationConfigurationStatus;
import com.gtdonrails.api.services.DataSyncService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequiredArgsConstructor
@Slf4j
public class GoogleCalendarController {

    private final GoogleCalendarService googleCalendarService;
    private final GoogleCalendarRepository calendarRepository;
    private final GoogleClientCredentialsStore credentialsStore;
    private final DataSyncService dataSyncService;

    @GetMapping("/integrations/google-calendar/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        boolean repairFailed = !repairLegacyConfigurationIfNeeded();
        boolean credentialsConfigured = credentialsStore.loadConfiguredCredentials();
        GoogleIntegrationConfigurationHealth configurationHealth = configurationHealth(repairFailed);
        GoogleCredential cred = googleCalendarService.getValidCredential();
        boolean connected = cred != null;
        List<GoogleCalendar> calendars = calendarRepository.findAll();

        Map<String, Object> status = new HashMap<>();
        status.put("credentialsConfigured", credentialsConfigured);
        status.put("configurationStatus", configurationHealth.status().name());
        status.put("configurationMessage", configurationHealth.message());
        status.put("connected", connected);
        status.put("calendars", calendars.stream().map(c -> Map.of(
                "name", c.getName(),
                "colorHex", c.getColorHex(),
                "googleCalendarId", c.getGoogleCalendarId()
        )).collect(Collectors.toList()));

        return ResponseEntity.ok(status);
    }

    private boolean repairLegacyConfigurationIfNeeded() {
        try {
            if (credentialsStore.repairMissingTokenEncryptionKey()) {
                dataSyncService.requestSync("integration credentials repaired");
            }
            return true;
        } catch (Exception exception) {
            log.error("Failed to repair Google Integration Configuration", exception);
            return false;
        }
    }

    private GoogleIntegrationConfigurationHealth configurationHealth(boolean repairFailed) {
        if (repairFailed) {
            return new GoogleIntegrationConfigurationHealth(
                GoogleIntegrationConfigurationStatus.REPAIR_FAILED,
                "Google Integration Configuration repair failed; fix data sync and try again.");
        }
        return credentialsStore.configurationHealth();
    }

    @PostMapping("/integrations/google-calendar/credentials")
    public ResponseEntity<Void> saveCredentials(@RequestBody Map<String, String> payload) {
        String clientId = payload.get("clientId");
        String clientSecret = payload.get("clientSecret");

        if (!credentialsPayloadValid(clientId, clientSecret)) return ResponseEntity.badRequest().build();

        try {
            credentialsStore.save(clientId, clientSecret);
            dataSyncService.requestSync("integration credentials updated");
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to save credentials", e);
            return ResponseEntity.status(503).build();
        }
    }

    private boolean credentialsPayloadValid(String clientId, String clientSecret) {
        return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
    }

    @PostMapping("/integrations/google-calendar/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl() {
        String redirectUri = ServletUriComponentsBuilder.fromCurrentContextPath().path("/oauth/google/callback").toUriString();
        String url = googleCalendarService.buildAuthUrl(redirectUri);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/oauth/google/callback")
    public ResponseEntity<String> oauthCallback(@RequestParam("code") String code) {
        String redirectUri = ServletUriComponentsBuilder.fromCurrentContextPath().path("/oauth/google/callback").toUriString();
        try {
            if (!configurationReady()) return configurationNotReadyResponse();
            googleCalendarService.exchangeCodeForTokens(code, redirectUri);
            googleCalendarService.setupGtdCalendars();
            return ResponseEntity.ok("<html><body><h2>Connected!</h2><p>You can close this window and return to the app.</p><script>window.close();</script></body></html>");
        } catch (Exception e) {
            log.error("OAuth callback failed", e);
            return ResponseEntity.internalServerError().body("<html><body><h2>Failed to connect</h2><p>An unexpected error occurred. Please try again later.</p></body></html>");
        }
    }

    private boolean configurationReady() {
        return credentialsStore.configurationHealth().status() == GoogleIntegrationConfigurationStatus.READY;
    }

    private ResponseEntity<String> configurationNotReadyResponse() {
        return ResponseEntity.status(503).body("<html><body><h2>Google Calendar configuration is not ready</h2><p>Return to the app and fix Google Calendar configuration first.</p></body></html>");
    }
}
