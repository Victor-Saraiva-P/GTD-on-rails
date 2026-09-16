package com.gtdonrails.api.dtos.somedaymaybe;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;

public record SomedayMaybeResponseDto(
    UUID id,
    String title,
    ItemBody body,
    String status,
    Instant createdAt,
    UUID projectId,
    String projectTitle
) {
    public SomedayMaybeResponseDto(UUID id, String title, ItemBody body, String status, Instant createdAt, String projectTitle) {
        this(id, title, body, status, createdAt, null, projectTitle);
    }
}
