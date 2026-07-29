package com.gtdonrails.api.controllers;

import com.gtdonrails.api.services.DatabaseReadinessService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReadinessController {

    private final DatabaseReadinessService readinessService;

    public ReadinessController(DatabaseReadinessService readinessService) {
        this.readinessService = readinessService;
    }

    /** Reports whether the application can accept database-backed requests.
     *
     * <p>Example: {@code GET /readiness}.</p>
     */
    @GetMapping("/readiness")
    public ResponseEntity<Void> readiness() {
        return readinessService.isReady()
            ? ResponseEntity.ok().build()
            : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }
}
