package com.gtdonrails.api.dtos;

import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateInboxItemRequestDto(
    @NotBlank(message = "title is required")
    @Size(max = Title.MAX_LENGTH, message = "title exceeds max length of " + Title.MAX_LENGTH)
    String title,

    @Size(max = Body.MAX_LENGTH, message = "body exceeds max length of " + Body.MAX_LENGTH)
    String body
) {
}
