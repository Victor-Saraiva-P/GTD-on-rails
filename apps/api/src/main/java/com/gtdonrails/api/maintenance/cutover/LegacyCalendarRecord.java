package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record LegacyCalendarRecord(
    UUID itemId,
    LocalDate scheduledDate,
    LocalTime scheduledTime,
    LocalDate dateStart,
    LocalDate dateEnd,
    LocalTime timeStart,
    LocalTime timeEnd,
    boolean allDay,
    String status,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {}
