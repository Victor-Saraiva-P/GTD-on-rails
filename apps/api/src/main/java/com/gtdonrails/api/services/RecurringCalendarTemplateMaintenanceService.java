package com.gtdonrails.api.services;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;

import com.gtdonrails.api.entities.MaintenanceRun;
import com.gtdonrails.api.repositories.MaintenanceRunRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RecurringCalendarTemplateMaintenanceService {

    private static final String RUN_NAME = "recurring-calendar-template-horizon-refresh";

    private final RecurringCalendarTemplateService recurringCalendarTemplateService;
    private final MaintenanceRunRepository maintenanceRunRepository;
    private final Clock clock;
    private final boolean enabled;

    public RecurringCalendarTemplateMaintenanceService(
        RecurringCalendarTemplateService recurringCalendarTemplateService,
        MaintenanceRunRepository maintenanceRunRepository,
        Clock clock,
        @Value("${gtd.recurring-calendar-templates.maintenance.enabled:true}") boolean enabled
    ) {
        this.recurringCalendarTemplateService = recurringCalendarTemplateService;
        this.maintenanceRunRepository = maintenanceRunRepository;
        this.clock = clock;
        this.enabled = enabled;
    }

    /**
     * Queues startup catch-up without blocking API readiness.
     *
     * <p>Example: {@code maintenanceService.queueStartupRefresh()}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void queueStartupRefresh() {
        if (!enabled) return;
        CompletableFuture.runAsync(this::runIfDue);
    }

    /**
     * Runs the daily horizon refresh check while the backend is open.
     *
     * <p>Example: {@code maintenanceService.runScheduledRefresh()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.recurring-calendar-templates.refresh-interval-ms:86400000}")
    public void runScheduledRefresh() {
        runIfDue();
    }

    /**
     * Refreshes active template horizons when daily maintenance is due.
     *
     * <p>Example: {@code maintenanceService.runIfDue()}.</p>
     */
    public void runIfDue() {
        if (!enabled) return;
        Instant now = Instant.now(clock);
        if (!refreshIsDue(now)) return;
        recurringCalendarTemplateService.refreshActiveTemplateHorizons();
        markCompleted(now);
    }

    private boolean refreshIsDue(Instant now) {
        return maintenanceRunRepository.findById(RUN_NAME)
            .map(run -> refreshIsDue(run, now))
            .orElse(true);
    }

    private boolean refreshIsDue(MaintenanceRun run, Instant now) {
        LocalDate lastRun = LocalDate.ofInstant(run.getLastRunAt(), clock.getZone());
        LocalDate today = LocalDate.ofInstant(now, clock.getZone());
        return lastRun.isBefore(today);
    }

    private void markCompleted(Instant now) {
        MaintenanceRun run = maintenanceRunRepository.findById(RUN_NAME)
            .orElse(new MaintenanceRun(RUN_NAME, now));
        run.markCompletedAt(now);
        maintenanceRunRepository.save(run);
    }
}
