package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.util.UUID;

public record LegacyContextIconAssetRecord(
    UUID id,
    UUID contextId,
    String fileName,
    String originalFileName,
    String contentType,
    long size,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
