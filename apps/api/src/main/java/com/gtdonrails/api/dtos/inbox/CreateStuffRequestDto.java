package com.gtdonrails.api.dtos.inbox;

import com.gtdonrails.api.types.Title;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStuffRequestDto(
    @NotBlank(message = "expected non-blank text")
    @Size(max = Title.MAX_LENGTH, message = "expected at most " + Title.MAX_LENGTH + " characters")
    String title
) {
}
