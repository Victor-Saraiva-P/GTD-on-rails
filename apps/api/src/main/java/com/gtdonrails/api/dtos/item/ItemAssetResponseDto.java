package com.gtdonrails.api.dtos.item;

public record ItemAssetResponseDto(
    String relativePath,
    String url,
    String fileName,
    String contentType,
    boolean image
) {
}
