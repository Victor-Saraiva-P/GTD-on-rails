package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.util.UUID;

public record LegacyItemAssetRecord(
    UUID id,
    UUID itemId,
    String fileName,
    String originalFileName,
    String contentType,
    long size,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
