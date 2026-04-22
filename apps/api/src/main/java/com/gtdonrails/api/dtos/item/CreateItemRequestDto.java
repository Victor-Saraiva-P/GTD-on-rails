package com.gtdonrails.api.dtos.item;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateItemRequestDto(
    @NotBlank(message = "title is required")
    @Size(max = Title.MAX_LENGTH, message = "title exceeds max length of " + Title.MAX_LENGTH)
    String title,

    @Size(max = Body.MAX_LENGTH, message = "body exceeds max length of " + Body.MAX_LENGTH)
    String body,

    @Size(
        max = Context.MAX_CONTEXTS_PER_ITEM,
        message = "contextIds exceeds max size of " + Context.MAX_CONTEXTS_PER_ITEM)
    List<UUID> contextIds
) {
}
