package com.gtdonrails.api.controllers;

import java.util.UUID;

import com.gtdonrails.api.dtos.item.AssignProjectRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.services.ItemService;
import com.gtdonrails.api.services.ProjectItemService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    private final ProjectItemService projectItemService;

    public ItemController(ItemService itemService, ProjectItemService projectItemService) {
        this.itemService = itemService;
        this.projectItemService = projectItemService;
    }

    /**
     * Handles title-only updates for one active item.
     *
     * <p>Example: {@code PATCH /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/title}.</p>
     */
    @PatchMapping("/{id}/title")
    public ItemResponseDto patchItemTitle(@PathVariable UUID id, @Valid @RequestBody UpdateItemTitleRequestDto request) {
        return itemService.updateItemTitle(id, request);
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

    /**
     * Handles project association updates for an item.
     *
     * <p>Example: {@code PUT /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/project}.</p>
     */
    @PutMapping("/{id}/project")
    public ItemResponseDto assignProject(@PathVariable UUID id, @RequestBody AssignProjectRequestDto request) {
        return projectItemService.assignProject(id, request.projectId());
    }

    /**
     * Handles project association removal for an item.
     *
     * <p>Example: {@code DELETE /items/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/project}.</p>
     */
    @DeleteMapping("/{id}/project")
    public ItemResponseDto removeProject(@PathVariable UUID id) {
        return projectItemService.assignProject(id, null);
    }
}
