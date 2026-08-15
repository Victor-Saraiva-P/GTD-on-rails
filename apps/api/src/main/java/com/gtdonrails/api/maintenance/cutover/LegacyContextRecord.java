package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.util.UUID;

public record LegacyContextRecord(
    UUID id,
    String name,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
