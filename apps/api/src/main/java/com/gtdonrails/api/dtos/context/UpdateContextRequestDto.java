package com.gtdonrails.api.dtos.context;

import com.gtdonrails.api.entities.Context;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateContextRequestDto(
    @NotBlank(message = "expected non-blank text")
    @Size(max = Context.MAX_NAME_LENGTH, message = "expected at most " + Context.MAX_NAME_LENGTH + " characters")
    String name
) {
}
