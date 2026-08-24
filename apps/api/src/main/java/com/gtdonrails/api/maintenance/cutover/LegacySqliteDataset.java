package com.gtdonrails.api.maintenance.cutover;

import java.util.List;

public record LegacySqliteDataset(
    List<LegacyItemRecord> items,
    List<LegacyContextRecord> contexts,
    List<LegacyItemAssetRecord> itemAssets,
    List<LegacyContextIconAssetRecord> contextIconAssets,
    List<LegacyNextActionRecord> nextActions,
    List<LegacyNextActionContextRecord> nextActionContexts,
    List<LegacyCalendarRecord> calendars,
    List<LegacyMaintenanceRunRecord> maintenanceRuns,
    List<LegacyGoogleCredentialRecord> googleCredentials,
    List<LegacyGoogleCalendarRecord> googleCalendars
) {
    /**
     * Calculates the total number of records across all datasets.
     *
     * <p>Example: {@code int total = dataset.totalRecordCount();}.</p>
     */
    public int totalRecordCount() {
        return items.size()
            + contexts.size()
            + itemAssets.size()
            + contextIconAssets.size()
            + nextActions.size()
            + nextActionContexts.size()
            + calendars.size()
            + maintenanceRuns.size()
            + googleCredentials.size()
            + googleCalendars.size();
    }
}
