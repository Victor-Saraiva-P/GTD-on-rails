package com.gtdonrails.api.controllers;

import com.gtdonrails.api.services.DatabaseReadinessResponse;
import com.gtdonrails.api.services.DatabaseReadinessService;
import com.gtdonrails.api.services.DatabaseReadinessState;
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
    public ResponseEntity<DatabaseReadinessResponse> readiness() {
        DatabaseReadinessState state = readinessService.readinessState();
        if (state == DatabaseReadinessState.READY) {
            return ResponseEntity.ok(new DatabaseReadinessResponse("READY", "authoritative PostgreSQL ready"));
        }
        if (state == DatabaseReadinessState.UPDATE_REQUIRED) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new DatabaseReadinessResponse("UPDATE_REQUIRED", "An application update is required to access the shared database schema."));
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new DatabaseReadinessResponse("UNAVAILABLE", "PostgreSQL unavailable"));
    }
}
