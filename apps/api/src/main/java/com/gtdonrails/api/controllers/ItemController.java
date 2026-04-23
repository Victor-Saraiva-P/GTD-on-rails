package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.services.ItemService;
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
@RequestMapping("/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping("/{id}")
    public ItemResponseDto getItem(@PathVariable UUID id) {
        return itemService.getItem(id);
    }

    @PostMapping
    public ResponseEntity<ItemResponseDto> createItem(@Valid @RequestBody CreateItemRequestDto request) {
        ItemResponseDto response = itemService.createItem(request);
        return ResponseEntity
            .created(URI.create("/items/" + response.id()))
            .body(response);
    }

    @PutMapping("/{id}")
    public ItemResponseDto updateItem(@PathVariable UUID id, @Valid @RequestBody UpdateItemRequestDto request) {
        return itemService.updateItem(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        itemService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }
}
