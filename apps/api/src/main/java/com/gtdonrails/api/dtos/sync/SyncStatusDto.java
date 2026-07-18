package com.gtdonrails.api.dtos.sync;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SyncStatusDto(
    FileSyncStatusDto file,
    GoogleCalendarSyncStatusDto googleCalendar
) {
    /**
     * Keeps the pre-File Sync response name available during the migration.
     *
     * <p>Example: {@code status.data()}.</p>
     */
    @JsonProperty("data")
    public FileSyncStatusDto data() {
        return file;
    }
}
