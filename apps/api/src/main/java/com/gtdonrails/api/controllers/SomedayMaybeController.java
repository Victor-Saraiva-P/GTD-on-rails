package com.gtdonrails.api.controllers;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.somedaymaybe.SomedayMaybeResponseDto;
import com.gtdonrails.api.services.SomedayMaybeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/someday-maybe")
public class SomedayMaybeController {

    private final SomedayMaybeService somedayMaybeService;

    public SomedayMaybeController(SomedayMaybeService somedayMaybeService) {
        this.somedayMaybeService = somedayMaybeService;
    }

    /**
     * Handles requests for active someday/maybe items.
     *
     * <p>Example: {@code GET /someday-maybe}.</p>
     */
    @GetMapping
    public List<SomedayMaybeResponseDto> listSomedayMaybe() {
        return somedayMaybeService.listSomedayMaybe();
    }

    /**
     * Handles requests for deleted someday/maybe items.
     *
     * <p>Example: {@code GET /someday-maybe/deleted}.</p>
     */
    @GetMapping("/deleted")
    public List<SomedayMaybeResponseDto> listDeletedSomedayMaybe() {
        return somedayMaybeService.listDeletedSomedayMaybe();
    }

    /**
     * Handles someday/maybe item lookup requests.
     *
     * <p>Example: {@code GET /someday-maybe/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @GetMapping("/{id}")
    public SomedayMaybeResponseDto getSomedayMaybe(@PathVariable UUID id) {
        return somedayMaybeService.getSomedayMaybe(id);
    }

    /**
     * Handles conversion from a someday/maybe item back to inbox stuff.
     *
     * <p>Example: {@code POST /someday-maybe/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/stuff}.</p>
     */
    @PostMapping("/{id}/stuff")
    public ResponseEntity<Void> revertToStuff(@PathVariable UUID id) {
        somedayMaybeService.revertToStuff(id);
        return ResponseEntity.noContent().build();
    }
}
