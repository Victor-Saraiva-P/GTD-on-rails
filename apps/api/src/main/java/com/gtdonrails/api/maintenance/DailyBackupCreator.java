package com.gtdonrails.api.maintenance;

public interface DailyBackupCreator {

    /** Creates the current day's production backup when one does not already exist.
     *
     * <p>Example: {@code dailyBackupCreator.createDailyBackupIfMissing()}.</p>
     */
    void createDailyBackupIfMissing();
}
