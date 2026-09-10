package com.gtdonrails.api.dtos.inbox;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;

public record StuffResponseDto(
    UUID id,
    String title,
    ItemBody body,
    String status,
    Instant createdAt,
    UUID projectId,
    String projectTitle
) {
    public StuffResponseDto(UUID id, String title, ItemBody body, String status, Instant createdAt, String projectTitle) {
        this(id, title, body, status, createdAt, null, projectTitle);
    }
}
