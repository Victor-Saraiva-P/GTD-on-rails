package com.gtdonrails.api.controllers;

import java.net.URI;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.PatchItemRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.services.ItemService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    /**
     * Handles item lookup requests for one active item.
     *
     * <p>Example: {@code GET /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @GetMapping("/{id}")
    public ItemResponseDto getItem(@PathVariable UUID id) {
        return itemService.getItem(id);
    }

    /**
     * Handles item creation requests and returns the created resource location.
     *
     * <p>Example: {@code POST /items}.</p>
     */
    @PostMapping
    public ResponseEntity<ItemResponseDto> createItem(@Valid @RequestBody CreateItemRequestDto request) {
        ItemResponseDto response = itemService.createItem(request);
        return ResponseEntity
            .created(URI.create("/items/" + response.id()))
            .body(response);
    }

    /**
     * Handles full item update requests for one active item.
     *
     * <p>Example: {@code PUT /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @PutMapping("/{id}")
    public ItemResponseDto updateItem(@PathVariable UUID id, @Valid @RequestBody UpdateItemRequestDto request) {
        return itemService.updateItem(id, request);
    }

    /**
     * Handles partial item metadata updates for one active item.
     *
     * <p>Example: {@code PATCH /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @PatchMapping("/{id}")
    public ItemResponseDto patchItem(@PathVariable UUID id, @RequestBody PatchItemRequestDto request) {
        return itemService.patchItem(id, request);
    }

    /**
     * Handles body-only updates for one active item.
     *
     * <p>Example: {@code PATCH /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/body}.</p>
     */
    @PatchMapping("/{id}/body")
    public ItemResponseDto patchItemBody(@PathVariable UUID id, @Valid @RequestBody PatchItemBodyRequestDto request) {
        return itemService.patchItemBody(id, request);
    }

    /**
     * Handles item asset upload requests and returns markdown-ready asset metadata.
     *
     * <p>Example: {@code POST /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/assets}.</p>
     */
    @PostMapping("/{id}/assets")
    public ItemAssetResponseDto uploadItemAsset(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return itemService.storeItemAsset(id, file);
    }

    /**
     * Handles item deletion requests by soft deleting the item.
     *
     * <p>Example: {@code DELETE /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        itemService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Handles item restoration requests by clearing the soft deletion flag.
     *
     * <p>Example: {@code POST /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/restore}.</p>
     */
    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restoreItem(@PathVariable UUID id) {
        itemService.restoreItem(id);
        return ResponseEntity.noContent().build();
    }
}
