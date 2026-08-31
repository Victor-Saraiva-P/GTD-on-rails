package com.gtdonrails.api.dtos.project;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.types.ItemBody;

public record ProjectItemResponseDto(
    UUID projectId,
    UUID id,
    String kind,
    String title,
    ItemBody body,
    Instant createdAt,
    LocalDate scheduledDate,
    LocalTime scheduledTime,
    LocalDate deadline,
    BigDecimal energy,
    Duration estimatedTime,
    List<ContextResponseDto> contexts
) {
}
