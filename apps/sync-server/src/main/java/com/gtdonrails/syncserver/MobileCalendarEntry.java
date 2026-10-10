package com.gtdonrails.syncserver;

public record MobileCalendarEntry(
    String id,
    String title,
    String sourceKind,
    String temporalState,
    String date,
    String scheduledTime,
    String deadline,
    String status,
    String projectTitle,
    String createdAt
) {
}
