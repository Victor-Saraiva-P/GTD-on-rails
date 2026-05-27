package com.gtdonrails.api.controllers;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCalendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.services.GoogleCalendarService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequiredArgsConstructor
@Slf4j
public class GoogleCalendarController {

    private final GoogleCalendarService googleCalendarService;
    private final GoogleCalendarRepository calendarRepository;
    private final GoogleProperties googleProperties;

    @Value("${gtd.data.root-directory}")
    private String dataRoot;

    @GetMapping("/api/integrations/google-calendar/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        boolean credentialsConfigured = googleProperties.getClientId() != null && !googleProperties.getClientId().isEmpty();
        GoogleCredential cred = googleCalendarService.getValidCredential();
        boolean connected = cred != null;
        List<GoogleCalendar> calendars = calendarRepository.findAll();

        Map<String, Object> status = new HashMap<>();
        status.put("credentialsConfigured", credentialsConfigured);
        status.put("connected", connected);
        status.put("calendars", calendars.stream().map(c -> Map.of(
                "name", c.getName(),
                "colorHex", c.getColorHex(),
                "googleCalendarId", c.getGoogleCalendarId()
        )).collect(Collectors.toList()));

        return ResponseEntity.ok(status);
    }

    @PostMapping("/api/integrations/google-calendar/credentials")
    public ResponseEntity<Void> saveCredentials(@RequestBody Map<String, String> payload) {
        String clientId = payload.get("clientId");
        String clientSecret = payload.get("clientSecret");

        if (clientId == null || clientId.trim().isEmpty() || clientSecret == null || clientSecret.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Path configPath = Paths.get(dataRoot, "config", "google.properties");
            Files.createDirectories(configPath.getParent());
            String content = "gtd.google.client-id=" + clientId.trim() + "\n" +
                             "gtd.google.client-secret=" + clientSecret.trim() + "\n";
            Files.writeString(configPath, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            
            // Hot reload properties for current session
            googleProperties.setClientId(clientId.trim());
            googleProperties.setClientSecret(clientSecret.trim());
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to save credentials", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/api/integrations/google-calendar/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl() {
        String redirectUri = ServletUriComponentsBuilder.fromCurrentContextPath().path("/oauth/google/callback").toUriString();
        String url = googleCalendarService.buildAuthUrl(redirectUri);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/oauth/google/callback")
    public ResponseEntity<String> oauthCallback(@RequestParam("code") String code) {
        String redirectUri = ServletUriComponentsBuilder.fromCurrentContextPath().path("/oauth/google/callback").toUriString();
        try {
            googleCalendarService.exchangeCodeForTokens(code, redirectUri);
            googleCalendarService.setupGtdCalendars();
            return ResponseEntity.ok("<html><body><h2>Connected!</h2><p>You can close this window and return to the app.</p><script>window.close();</script></body></html>");
        } catch (Exception e) {
            log.error("OAuth callback failed", e);
            return ResponseEntity.internalServerError().body("<html><body><h2>Failed to connect</h2><p>" + e.getMessage() + "</p></body></html>");
        }
    }
}
