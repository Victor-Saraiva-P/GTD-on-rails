package com.gtdonrails.api.dtos.project;

import java.time.LocalDate;

import com.gtdonrails.api.types.Title;
import jakarta.validation.constraints.Size;

public record PatchProjectRequestDto(
    @Size(max = Title.MAX_LENGTH, message = "expected at most " + Title.MAX_LENGTH + " characters")
    String title,
    LocalDate deadline,
    Boolean clearDeadline
) {
}
