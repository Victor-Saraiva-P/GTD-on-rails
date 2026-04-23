package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.services.ContextService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.validation.annotation.Validated;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Validated
@RequestMapping("/contexts")
public class ContextController {

    private final ContextService contextService;

    public ContextController(ContextService contextService) {
        this.contextService = contextService;
    }

    @GetMapping
    public List<ContextResponseDto> listContexts() {
        return contextService.listContexts();
    }

    @GetMapping("/{id}")
    public ContextResponseDto getContext(@PathVariable UUID id) {
        return contextService.getContext(id);
    }

    @GetMapping("/{id}/items")
    public List<ContextItemResponseDto> listContextItems(
        @PathVariable UUID id,
        @RequestParam(required = false) @Positive(message = "limit must be greater than 0") Integer limit
    ) {
        return contextService.listContextItems(id, limit);
    }

    @PostMapping
    public ResponseEntity<ContextResponseDto> createContext(@Valid @RequestBody CreateContextRequestDto request) {
        ContextResponseDto response = contextService.createContext(request);
        return ResponseEntity
            .created(URI.create("/contexts/" + response.id()))
            .body(response);
    }

    @PutMapping("/{id}")
    public ContextResponseDto updateContext(@PathVariable UUID id, @Valid @RequestBody UpdateContextRequestDto request) {
        return contextService.updateContext(id, request);
    }

    @PutMapping("/{id}/icon")
    public ContextResponseDto updateContextIcon(
        @PathVariable UUID id,
        @RequestPart("file") MultipartFile file
    ) {
        return contextService.updateContextIcon(id, file);
    }

    @DeleteMapping("/{id}/icon")
    public ContextResponseDto deleteContextIcon(@PathVariable UUID id) {
        return contextService.deleteContextIcon(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContext(@PathVariable UUID id) {
        contextService.deleteContext(id);
        return ResponseEntity.noContent().build();
    }
}
