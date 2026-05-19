package com.gtdonrails.api.dtos.context;

import java.util.UUID;

public record ContextResponseDto(
    UUID id,
    String name,
    String iconUrl
) {
}
