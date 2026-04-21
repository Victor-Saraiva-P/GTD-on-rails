package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.inbox.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.inbox.InboxItemResponseDto;
import com.gtdonrails.api.dtos.inbox.UpdateInboxItemRequestDto;
import com.gtdonrails.api.services.InboxService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/inbox/items")
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    @GetMapping
    public List<InboxItemResponseDto> listStuff() {
        return inboxService.listStuff();
    }

    @GetMapping("/{id}")
    public InboxItemResponseDto getStuff(@PathVariable UUID id) {
        return inboxService.getStuff(id);
    }

    @PostMapping
    public ResponseEntity<InboxItemResponseDto> createStuff(@Valid @RequestBody CreateInboxItemRequestDto request) {
        InboxItemResponseDto response = inboxService.createStuff(request);
        return ResponseEntity
            .created(URI.create("/inbox/items/" + response.id()))
            .body(response);
    }

    @PutMapping("/{id}")
    public InboxItemResponseDto updateStuff(@PathVariable UUID id, @Valid @RequestBody UpdateInboxItemRequestDto request) {
        return inboxService.updateStuff(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStuff(@PathVariable UUID id) {
        inboxService.deleteStuff(id);
        return ResponseEntity.noContent().build();
    }
}
