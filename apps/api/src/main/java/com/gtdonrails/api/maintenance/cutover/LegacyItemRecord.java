package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.util.UUID;

public record LegacyItemRecord(
    UUID id,
    String title,
    String body,
    String status,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
