package com.gtdonrails.api.dtos.item;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;

public record ItemResponseDto(
    UUID id,
    String title,
    String body,
    BigDecimal energy,
    ItemTimeDto time,
    String status,
    Instant createdAt,
    List<ContextResponseDto> contexts
) {
}
