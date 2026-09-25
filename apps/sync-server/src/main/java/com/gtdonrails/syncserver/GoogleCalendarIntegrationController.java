package com.gtdonrails.syncserver;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GoogleCalendarIntegrationController {

    private final GoogleCalendarCredentialsStore credentials;
    private final GoogleCalendarMirrorStore mirrors;
    private final GoogleCalendarOAuthService oauth;
    private final GoogleCalendarReconciliationService reconciliation;
    private final GoogleCalendarProjectionQueue queue;
    private final String publicBaseUrl;

    public GoogleCalendarIntegrationController(
        GoogleCalendarCredentialsStore credentials,
        GoogleCalendarMirrorStore mirrors,
        GoogleCalendarOAuthService oauth,
        GoogleCalendarReconciliationService reconciliation,
        GoogleCalendarProjectionQueue queue,
        @Value("$" + "{gtd.sync-server.public-base-url:http://127.0.0.1:9473}") String publicBaseUrl
    ) {
        this.credentials = credentials;
        this.mirrors = mirrors;
        this.oauth = oauth;
        this.reconciliation = reconciliation;
        this.queue = queue;
        this.publicBaseUrl = stripTrailingSlash(publicBaseUrl);
    }

    @GetMapping("/v1/integrations/google-calendar/status")
    public IntegrationStatus status() {
        boolean configured = credentials.credentialsConfigured();
        return new IntegrationStatus(
            configured,
            configured ? "READY" : "MISSING",
            configured
                ? "Google Calendar configuration is ready on the sync client."
                : "Google OAuth client credentials are missing on the sync client.",
            credentials.connected(),
            calendarInfo()
        );
    }

    @PostMapping("/v1/integrations/google-calendar/credentials")
    public ResponseEntity<Void> saveCredentials(@RequestBody ClientCredentials request) {
        credentials.saveClientCredentials(request.clientId(), request.clientSecret());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/v1/integrations/google-calendar/auth-url")
    public Map<String, String> authUrl() {
        return Map.of("url", oauth.buildAuthUrl(callbackUrl()));
    }

    @PostMapping("/v1/integrations/google-calendar/reconcile")
    public ResponseEntity<Void> reconcile() {
        reconciliation.reconcile();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/v1/integrations/google-calendar/sync-status")
    public GoogleCalendarProjectionQueue.GoogleCalendarSyncStatus syncStatus() {
        return queue.status();
    }

    @GetMapping("/oauth/google/callback")
    public ResponseEntity<String> callback(
        @RequestParam String code,
        @RequestParam String state
    ) {
        try {
            oauth.exchangeCode(code, state, callbackUrl());
            reconciliation.reconcile();
            return ResponseEntity.ok(successPage());
        } catch (RuntimeException exception) {
            return ResponseEntity.internalServerError().body(failurePage());
        }
    }

    private List<CalendarInfo> calendarInfo() {
        return mirrors.calendars().stream()
            .map(calendar -> new CalendarInfo(
                calendar.name(),
                calendar.colorHex(),
                calendar.googleCalendarId()
            ))
            .toList();
    }

    private String callbackUrl() {
        return publicBaseUrl + "/oauth/google/callback";
    }

    private String successPage() {
        return "<html><body><h2>Connected!</h2>"
            + "<p>You can close this window and return to GTD on Rails.</p>"
            + "<script>window.close();</script></body></html>";
    }

    private String failurePage() {
        return "<html><body><h2>Failed to connect</h2>"
            + "<p>An unexpected error occurred. Return to GTD on Rails and try again.</p>"
            + "</body></html>";
    }

    private String stripTrailingSlash(String value) {
        URI uri = URI.create(value);
        String normalized = uri.toString();
        return normalized.endsWith("/")
            ? normalized.substring(0, normalized.length() - 1)
            : normalized;
    }

    public record ClientCredentials(String clientId, String clientSecret) {
    }

    public record CalendarInfo(String name, String colorHex, String googleCalendarId) {
    }

    public record IntegrationStatus(
        boolean credentialsConfigured,
        String configurationStatus,
        String configurationMessage,
        boolean connected,
        List<CalendarInfo> calendars
    ) {
    }
}
