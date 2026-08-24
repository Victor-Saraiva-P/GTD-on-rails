package com.gtdonrails.api.maintenance.cutover;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record LegacyNextActionRecord(
    UUID itemId,
    BigDecimal energy,
    long estimatedTimeMinutes,
    LocalDate dateStart,
    LocalDate dateEnd,
    LocalTime timeStart,
    LocalTime timeEnd,
    boolean allDay,
    LocalDate deadline,
    String status,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
