package com.gtdonrails.api.controllers;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.dtos.nextaction.PatchNextActionRequestDto;
import com.gtdonrails.api.services.NextActionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
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

    @PostMapping("/{id}/reset-status")
    public NextActionResponseDto resetNextActionStatus(@PathVariable UUID id) {
        return nextActionService.resetNextActionStatus(id);
    }

    @GetMapping
    public List<NextActionResponseDto> getNextActions(
        @RequestParam(required = false) UUID contextId,
        @RequestParam(required = false) @Min(0) Integer currentTimeMinutes,
        @RequestParam(required = false)
        @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal currentEnergy,
        @RequestParam String orderBy
    ) {
        if ("priority".equalsIgnoreCase(orderBy)) {
            return nextActionService.getOrderedByPriority(contextId, currentTimeMinutes, currentEnergy);
        }
        if ("time".equalsIgnoreCase(orderBy)) {
            return nextActionService.getOrderedByTime(contextId);
        } else if ("energy".equalsIgnoreCase(orderBy)) {
            return nextActionService.getOrderedByEnergy(contextId);
        } else {
            throw new IllegalArgumentException("Invalid orderBy parameter. Expected 'energy', 'time', or 'priority'.");
        }
    }

    @GetMapping("/ongoing")
    public List<NextActionResponseDto> getOnGoingNextActions() {
        return nextActionService.getOnGoingNextActions();
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
