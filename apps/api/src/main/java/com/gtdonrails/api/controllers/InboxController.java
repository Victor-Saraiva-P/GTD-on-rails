package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.ConvertStuffToCalendarRequestDto;
import com.gtdonrails.api.dtos.inbox.ConvertStuffToNextActionRequestDto;
import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.inbox.StuffResponseDto;
import com.gtdonrails.api.services.InboxService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/inbox")
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    /**
     * Handles inbox requests for active items still classified as stuff.
     *
     * <p>Example: {@code GET /inbox}.</p>
     */
    @GetMapping
    public List<StuffResponseDto> listStuff() {
        return inboxService.listStuff();
    }

    /**
     * Handles inbox requests for deleted items still classified as stuff.
     *
     * <p>Example: {@code GET /inbox/deleted}.</p>
     */
    @GetMapping("/deleted")
    public List<StuffResponseDto> listDeletedStuff() {
        return inboxService.listDeletedStuff();
    }

    /**
     * Handles inbox stuff lookup requests.
     *
     * <p>Example: {@code GET /inbox/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @GetMapping("/{id}")
    public StuffResponseDto getStuff(@PathVariable UUID id) {
        return inboxService.getStuff(id);
    }

    /**
     * Handles creation of captured inbox stuff.
     *
     * <p>Example: {@code POST /inbox}.</p>
     */
    @PostMapping
    public ResponseEntity<StuffResponseDto> createStuff(@Valid @RequestBody CreateStuffRequestDto request) {
        StuffResponseDto response = inboxService.createStuff(request);
        return ResponseEntity.created(URI.create("/inbox/" + response.id())).body(response);
    }

    /**
     * Handles conversion from inbox stuff into a GTD next action.
     *
     * <p>Example: {@code POST /inbox/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/next-action}.</p>
     */
    @PostMapping("/{id}/next-action")
    public ResponseEntity<Void> convertStuffToNextAction(
        @PathVariable UUID id,
        @Valid @RequestBody ConvertStuffToNextActionRequestDto request
    ) {
        inboxService.convertStuffToNextAction(id, request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Handles conversion from inbox stuff into a GTD calendar item.
     *
     * <p>Example: {@code POST /inbox/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/calendar}.</p>
     */
    @PostMapping("/{id}/calendar")
    public ResponseEntity<Void> convertStuffToCalendar(
        @PathVariable UUID id,
        @Valid @RequestBody ConvertStuffToCalendarRequestDto request
    ) {
        inboxService.convertStuffToCalendar(id, request);
        return ResponseEntity.noContent().build();
    }
}
