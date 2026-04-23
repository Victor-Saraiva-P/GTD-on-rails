package com.gtdonrails.api.dtos.context;

import java.util.UUID;

public record ContextItemResponseDto(
    UUID id,
    String title,
    String status
) {
}
