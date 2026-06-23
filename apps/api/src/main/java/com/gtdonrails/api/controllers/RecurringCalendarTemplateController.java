package com.gtdonrails.api.controllers;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.recurring.RecurringCalendarTemplateResponseDto;
import com.gtdonrails.api.dtos.recurring.UpdateRecurringCalendarTemplateRequestDto;
import com.gtdonrails.api.services.RecurringCalendarTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/recurring-calendar-templates")
public class RecurringCalendarTemplateController {

    private final RecurringCalendarTemplateService recurringCalendarTemplateService;

    public RecurringCalendarTemplateController(RecurringCalendarTemplateService recurringCalendarTemplateService) {
        this.recurringCalendarTemplateService = recurringCalendarTemplateService;
    }

    /**
     * Handles active Recurring Calendar Template list requests.
     *
     * <p>Example: {@code GET /recurring-calendar-templates}.</p>
     */
    @GetMapping
    public List<RecurringCalendarTemplateResponseDto> listActiveTemplates() {
        return recurringCalendarTemplateService.listActiveTemplates();
    }

    /**
     * Handles Recurring Calendar Template edit requests.
     *
     * <p>Example: {@code PATCH /recurring-calendar-templates/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @PatchMapping("/{id}")
    public RecurringCalendarTemplateResponseDto updateTemplate(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateRecurringCalendarTemplateRequestDto request
    ) {
        return recurringCalendarTemplateService.updateTemplate(id, request);
    }

    /**
     * Handles Recurring Calendar Template delete requests.
     *
     * <p>Example: {@code DELETE /recurring-calendar-templates/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        recurringCalendarTemplateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Handles Recurring Calendar Template restore requests.
     *
     * <p>Example: {@code POST /recurring-calendar-templates/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/restore}.</p>
     */
    @PostMapping("/{id}/restore")
    public RecurringCalendarTemplateResponseDto restoreTemplate(@PathVariable UUID id) {
        return recurringCalendarTemplateService.restoreTemplate(id);
    }
}
