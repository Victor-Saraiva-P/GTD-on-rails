package com.gtdonrails.api.maintenance;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class DailyBackupScheduler {

    private final DailyBackupCreator backupCreator;

    public DailyBackupScheduler(DailyBackupCreator backupCreator) {
        this.backupCreator = backupCreator;
    }

    /** Runs the production backup policy on the configured daily schedule.
     *
     * <p>Example: invoked by Spring using {@code gtd.backup.daily-cron}.</p>
     */
    @Scheduled(cron = "${gtd.backup.daily-cron:0 0 2 * * *}")
    public void createDailyBackup() {
        backupCreator.createDailyBackupIfMissing();
    }
}
