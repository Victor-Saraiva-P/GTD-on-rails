package com.gtdonrails.syncserver;

public record MobileCalendarItem(
    String id,
    String title,
    String scheduledDate,
    String scheduledTime,
    String status,
    String projectTitle
) {
}
