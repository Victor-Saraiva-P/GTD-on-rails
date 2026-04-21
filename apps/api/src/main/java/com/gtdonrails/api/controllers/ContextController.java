package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.services.ContextService;
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContext(@PathVariable UUID id) {
        contextService.deleteContext(id);
        return ResponseEntity.noContent().build();
    }
}
