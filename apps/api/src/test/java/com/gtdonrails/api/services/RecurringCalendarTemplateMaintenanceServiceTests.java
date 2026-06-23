package com.gtdonrails.api.services;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.gtdonrails.api.entities.MaintenanceRun;
import com.gtdonrails.api.repositories.MaintenanceRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class RecurringCalendarTemplateMaintenanceServiceTests {

    private static final Instant NOW = Instant.parse("2026-05-21T10:00:00Z");
    private static final String RUN_NAME = "recurring-calendar-template-horizon-refresh";

    @Mock
    private RecurringCalendarTemplateService recurringCalendarTemplateService;

    @Mock
    private MaintenanceRunRepository maintenanceRunRepository;

    private RecurringCalendarTemplateMaintenanceService maintenanceService;

    @BeforeEach
    void setUp() {
        maintenanceService = new RecurringCalendarTemplateMaintenanceService(
            recurringCalendarTemplateService, maintenanceRunRepository, fixedClock(), true);
    }

    @Test
    void refreshesHorizonsWhenNoDailyMaintenanceRunExists() {
        when(maintenanceRunRepository.findById(RUN_NAME)).thenReturn(Optional.empty());

        maintenanceService.runIfDue();

        verify(recurringCalendarTemplateService).refreshActiveTemplateHorizons();
        verify(maintenanceRunRepository).save(org.mockito.ArgumentMatchers.any(MaintenanceRun.class));
    }

    @Test
    void skipsRefreshWhenDailyMaintenanceAlreadyRanToday() {
        MaintenanceRun run = new MaintenanceRun(RUN_NAME, NOW.minusSeconds(60));
        when(maintenanceRunRepository.findById(RUN_NAME)).thenReturn(Optional.of(run));

        maintenanceService.runIfDue();

        verify(recurringCalendarTemplateService, never()).refreshActiveTemplateHorizons();
    }

    private Clock fixedClock() {
        return Clock.fixed(NOW, ZoneOffset.UTC);
    }
}
