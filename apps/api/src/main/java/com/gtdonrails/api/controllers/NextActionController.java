package com.gtdonrails.api.controllers;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.dtos.nextaction.PatchNextActionRequestDto;
import com.gtdonrails.api.services.NextActionService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/next-actions")
public class NextActionController {

    private final NextActionService nextActionService;

    public NextActionController(NextActionService nextActionService) {
        this.nextActionService = nextActionService;
    }

    @PatchMapping("/{id}")
    public NextActionResponseDto patchNextAction(
        @PathVariable UUID id,
        @Valid @RequestBody PatchNextActionRequestDto request
    ) {
        return nextActionService.patchNextAction(id, request);
    }

    @PostMapping("/{id}/ongoing")
    public NextActionResponseDto markOnGoing(@PathVariable UUID id) {
        return nextActionService.markOnGoing(id);
    }

    @PostMapping("/{id}/done")
    public NextActionResponseDto markDone(@PathVariable UUID id) {
        return nextActionService.markDone(id);
    }

    @PostMapping("/{id}/undone")
    public NextActionResponseDto markUndone(@PathVariable UUID id) {
        return nextActionService.markUndone(id);
    }

    @GetMapping
    public List<NextActionResponseDto> getNextActions(
        @RequestParam UUID contextId,
        @RequestParam String orderBy
    ) {
        if ("time".equalsIgnoreCase(orderBy)) {
            return nextActionService.getOrderedByTime(contextId);
        } else if ("energy".equalsIgnoreCase(orderBy)) {
            return nextActionService.getOrderedByEnergy(contextId);
        } else {
            throw new IllegalArgumentException("Invalid orderBy parameter. Expected 'energy' or 'time'.");
        }
    }

    @GetMapping("/deleted")
    public List<NextActionResponseDto> getDeletedNextActions() {
        return nextActionService.getDeletedNextActions();
    }

    @GetMapping("/done")
    public Page<NextActionResponseDto> getDoneNextActions(Pageable pageable) {
        return nextActionService.getDoneNextActions(pageable);
    }
}
