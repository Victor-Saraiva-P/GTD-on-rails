package com.gtdonrails.api.dtos.inbox;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;

public record StuffResponseDto(
    UUID id,
    String title,
    ItemBody body,
    Instant createdAt
) {
}
