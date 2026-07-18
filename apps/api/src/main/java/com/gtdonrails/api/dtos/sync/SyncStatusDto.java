package com.gtdonrails.api.dtos.sync;

public record SyncStatusDto(
    DataSyncStatusDto data,
    FileSyncStatusDto file,
    GoogleCalendarSyncStatusDto googleCalendar
) {
}
