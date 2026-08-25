package com.gtdonrails.api.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Pre-warms in-memory domain query caches upon application startup.
 */
@Service
public class CachePrewarmService {

    private static final Logger logger = LoggerFactory.getLogger(CachePrewarmService.class);

    private final DatabaseReadinessService databaseReadinessService;
    private final InboxService inboxService;
    private final NextActionService nextActionService;
    private final ProjectService projectService;
    private final ContextService contextService;
    private final CalendarService calendarService;

    public CachePrewarmService(
        DatabaseReadinessService databaseReadinessService,
        InboxService inboxService,
        NextActionService nextActionService,
        ProjectService projectService,
        ContextService contextService,
        CalendarService calendarService
    ) {
        this.databaseReadinessService = databaseReadinessService;
        this.inboxService = inboxService;
        this.nextActionService = nextActionService;
        this.projectService = projectService;
        this.contextService = contextService;
        this.calendarService = calendarService;
    }

    /**
     * Eagerly loads active dataset queries into the in-memory cache when the database is ready.
     *
     * <p>Example: {@code cachePrewarmService.prewarmCaches()}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void prewarmCaches() {
        if (!databaseReadinessService.isReady()) {
            logger.info("Database not ready; skipping cache pre-warming");
            return;
        }
        warmActiveDatasets();
    }

    private void warmActiveDatasets() {
        try {
            inboxService.listStuff();
            nextActionService.getOnGoingNextActions();
            nextActionService.getOrderedByEnergy(null);
            nextActionService.getOrderedByTime(null);
            projectService.listProjects();
            contextService.listContexts();
            calendarService.getTodayCalendars();
            logger.info("Cache pre-warming completed successfully");
        } catch (RuntimeException exception) {
            logger.atWarn()
                .addKeyValue("event", "cache_prewarm_failed")
                .setCause(exception)
                .log("Failed to pre-warm in-memory cache; will populate on demand");
        }
    }
}
