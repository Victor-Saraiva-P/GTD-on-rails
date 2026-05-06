package com.gtdonrails.api.dtos.item;

import java.util.UUID;

public record ItemAssetResponseDto(
    UUID id,
    String relativePath,
    String fileName,
    String contentType,
    boolean image
) {
}
