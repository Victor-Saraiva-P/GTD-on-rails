package com.gtdonrails.api.services;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class CachePrewarmServiceTests {

    @Mock
    private DatabaseReadinessService databaseReadinessService;

    @Mock
    private DatabaseSyncService databaseSyncService;

    @Mock
    private InboxService inboxService;

    @Mock
    private NextActionService nextActionService;

    @Mock
    private ProjectService projectService;

    @Mock
    private ContextService contextService;

    @Mock
    private CalendarService calendarService;

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-05-21T12:00:00Z"), ZoneId.of("UTC"));

    private CachePrewarmService cachePrewarmService;

    @BeforeEach
    void setUp() {
        cachePrewarmService = new CachePrewarmService(
            databaseReadinessService,
            databaseSyncService,
            inboxService,
            nextActionService,
            projectService,
            contextService,
            calendarService,
            CLOCK);
    }

    @Test
    void prewarmsCachesWhenDatabaseIsReady() {
        when(databaseReadinessService.isReady()).thenReturn(true);

        cachePrewarmService.prewarmCaches();

        verify(databaseSyncService).syncOnStartup();
        verify(inboxService).listStuff();
        verify(nextActionService).getOnGoingNextActions();
        verify(nextActionService).getOrderedByEnergy(null);
        verify(nextActionService).getOrderedByTime(null);
        verify(projectService).listProjects();
        verify(contextService).listContexts();
        verify(calendarService).getTodayEntries(LocalDate.parse("2026-05-21"));
    }

    @Test
    void skipsPrewarmWhenDatabaseIsNotReady() {
        when(databaseReadinessService.isReady()).thenReturn(false);

        cachePrewarmService.prewarmCaches();

        verify(inboxService, never()).listStuff();
        verify(nextActionService, never()).getOnGoingNextActions();
    }
}
