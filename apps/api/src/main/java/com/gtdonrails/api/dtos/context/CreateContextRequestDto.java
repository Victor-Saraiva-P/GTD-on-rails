package com.gtdonrails.api.dtos.context;

import com.gtdonrails.api.entities.Context;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateContextRequestDto(
    @NotBlank(message = "context name is required")
    @Size(max = Context.MAX_NAME_LENGTH, message = "context name exceeds max length of " + Context.MAX_NAME_LENGTH)
    String name
) {
}
