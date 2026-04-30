package com.gtdonrails.api.dtos.item;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.types.Body;

public record ItemResponseDto(
    UUID id,
    String title,
    Body body,
    BigDecimal energy,
    ItemTimeDto time,
    String status,
    Instant createdAt,
    List<ContextResponseDto> contexts
) {
}
