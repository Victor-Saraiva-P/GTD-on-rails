package com.gtdonrails.api.controllers;

import java.util.Map;

import com.gtdonrails.api.services.GoogleCalendarClientGateway;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GoogleCalendarController {

    private final GoogleCalendarClientGateway client;

    public GoogleCalendarController(GoogleCalendarClientGateway client) {
        this.client = client;
    }

    @GetMapping("/integrations/google-calendar/status")
    public ResponseEntity<Map<String, Object>> status() {
        try {
            return ResponseEntity.ok(client.status());
        } catch (RuntimeException exception) {
            return ResponseEntity.status(503).body(unavailableStatus());
        }
    }

    @PostMapping("/integrations/google-calendar/credentials")
    public ResponseEntity<Void> saveCredentials(@RequestBody Map<String, String> payload) {
        String clientId = payload.get("clientId");
        String clientSecret = payload.get("clientSecret");
        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) {
            return ResponseEntity.badRequest().build();
        }
        try {
            client.saveCredentials(clientId, clientSecret);
            return ResponseEntity.ok().build();
        } catch (RuntimeException exception) {
            return ResponseEntity.status(503).build();
        }
    }

    @PostMapping("/integrations/google-calendar/auth-url")
    public ResponseEntity<Map<String, Object>> authUrl() {
        try {
            return ResponseEntity.ok(client.authUrl());
        } catch (RuntimeException exception) {
            return ResponseEntity.status(503).build();
        }
    }

    @PostMapping("/integrations/google-calendar/reconcile")
    public ResponseEntity<Void> reconcile() {
        try {
            client.reconcile();
            return ResponseEntity.ok().build();
        } catch (RuntimeException exception) {
            return ResponseEntity.status(503).build();
        }
    }

    private Map<String, Object> unavailableStatus() {
        return Map.of(
            "credentialsConfigured", false,
            "configurationStatus", "UNAVAILABLE",
            "configurationMessage", "Google Calendar sync client is unavailable.",
            "connected", false,
            "calendars", java.util.List.of()
        );
    }
}
