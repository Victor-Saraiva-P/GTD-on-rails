package com.gtdonrails.api.dtos.sync;

public record SyncStatusDto(
    FileSyncStatusDto file,
    GoogleCalendarSyncStatusDto googleCalendar
) {}
