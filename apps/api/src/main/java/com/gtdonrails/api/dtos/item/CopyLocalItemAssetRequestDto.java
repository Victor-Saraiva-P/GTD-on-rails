package com.gtdonrails.api.dtos.item;

import jakarta.validation.constraints.NotBlank;

public record CopyLocalItemAssetRequestDto(
    @NotBlank(message = "expected non-blank source path")
    String sourcePath
) {
}
