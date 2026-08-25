package com.gtdonrails.api.dtos.project;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

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
    LocalDate deadline
) {
}
