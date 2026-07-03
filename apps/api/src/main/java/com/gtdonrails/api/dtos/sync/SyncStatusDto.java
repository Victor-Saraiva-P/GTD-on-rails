package com.gtdonrails.api.dtos.sync;

public record SyncStatusDto(
    DataSyncStatusDto data,
    GoogleCalendarSyncStatusDto googleCalendar
) {
}
