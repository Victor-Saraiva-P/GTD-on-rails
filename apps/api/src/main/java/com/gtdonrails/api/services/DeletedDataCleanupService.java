package com.gtdonrails.api.services;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.gtdonrails.api.config.CleanupProperties;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.entities.MaintenanceRun;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.MaintenanceRunRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeletedDataCleanupService {

    private static final String CLEANUP_NAME = "deleted-data-cleanup";

    private final CleanupProperties cleanupProperties;
    private final MaintenanceRunRepository maintenanceRunRepository;
    private final ItemRepository itemRepository;
    private final NextActionRepository nextActionRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final ContextRepository contextRepository;
    private final CalendarRepository calendarRepository;
    private final AssetStorageService assetStorageService;
    private final Clock clock;

    public DeletedDataCleanupService(
        CleanupProperties cleanupProperties,
        MaintenanceRunRepository maintenanceRunRepository,
        ItemRepository itemRepository,
        NextActionRepository nextActionRepository,
        ItemAssetRepository itemAssetRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        ContextRepository contextRepository,
        CalendarRepository calendarRepository,
        AssetStorageService assetStorageService,
        Clock clock
    ) {
        this.cleanupProperties = cleanupProperties;
        this.maintenanceRunRepository = maintenanceRunRepository;
        this.itemRepository = itemRepository;
        this.nextActionRepository = nextActionRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.contextRepository = contextRepository;
        this.calendarRepository = calendarRepository;
        this.assetStorageService = assetStorageService;
        this.clock = clock;
    }

    /**
     * Runs overdue cleanup when the API process becomes available.
     *
     * <p>Example: {@code cleanupService.runAfterStartup()}.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void runAfterStartup() {
        runIfDue();
    }

    /**
     * Checks periodically whether old soft-deleted data must be purged.
     *
     * <p>Example: {@code cleanupService.runScheduledCleanup()}.</p>
     */
    @Scheduled(fixedDelayString = "${gtd.cleanup.check-interval-ms:3600000}")
    @Transactional
    public void runScheduledCleanup() {
        runIfDue();
    }

    /**
     * Purges expired soft-deleted data only when the retention interval elapsed.
     *
     * <p>Example: {@code cleanupService.runIfDue()}.</p>
     */
    @Transactional
    public void runIfDue() {
        if (!cleanupProperties.isEnabled()) return;
        Instant now = Instant.now(clock);
        if (!cleanupIsDue(now)) return;
        purgeExpiredData(now);
        markCleanupCompleted(now);
    }

    private boolean cleanupIsDue(Instant now) {
        return maintenanceRunRepository.findById(CLEANUP_NAME)
            .map(run -> cleanupIsDue(run, now))
            .orElse(true);
    }

    private boolean cleanupIsDue(MaintenanceRun run, Instant now) {
        Duration retention = Duration.ofDays(cleanupProperties.getRetentionDays());
        return !run.getLastRunAt().plus(retention).isAfter(now);
    }

    private void purgeExpiredData(Instant now) {
        Instant cutoffInstant = now.minus(Duration.ofDays(cleanupProperties.getRetentionDays()));
        LocalDate cutoffDate = LocalDate.now(clock).minusDays(cleanupProperties.getRetentionDays());
        purgeExpiredItemAssets(cutoffInstant);
        purgeExpiredContextIconAssets(cutoffInstant);
        purgeExpiredDeletedContexts(cutoffInstant);
        purgeExpiredDeletedItems(cutoffInstant);
        purgeExpiredDoneNextActions(cutoffDate);
    }

    private void purgeExpiredItemAssets(Instant cutoff) {
        itemAssetRepository.findAllByDeletedAtLessThanEqual(cutoff)
            .forEach(this::purgeItemAsset);
    }

    private void purgeExpiredContextIconAssets(Instant cutoff) {
        contextIconAssetRepository.findAllByDeletedAtLessThanEqual(cutoff)
            .forEach(this::purgeContextIconAsset);
    }

    private void purgeExpiredDeletedContexts(Instant cutoff) {
        contextRepository.findAllByDeletedAtLessThanEqual(cutoff)
            .forEach(this::purgeContext);
    }

    private void purgeExpiredDeletedItems(Instant cutoff) {
        itemRepository.findAllByDeletedAtLessThanEqual(cutoff)
            .forEach(this::purgeItem);
    }

    private void purgeExpiredDoneNextActions(LocalDate cutoff) {
        nextActionRepository.findAllDoneBeforeDate(NextActionStatus.DONE, cutoff)
            .forEach(nextAction -> purgeItem(nextAction.getItem()));
    }

    private void purgeItem(Item item) {
        itemAssetRepository.findAllByItemId(item.getId()).forEach(this::deleteItemAssetFile);
        calendarRepository.makeOccurrencesIndependentForTemplate(item.getId());
        nextActionRepository.deleteContextLinks(item.getId());
        itemRepository.delete(item);
    }

    private void purgeItemAsset(ItemAsset itemAsset) {
        deleteItemAssetFile(itemAsset);
        itemAssetRepository.delete(itemAsset);
    }

    private void deleteItemAssetFile(ItemAsset itemAsset) {
        assetStorageService.deleteAsset(itemAsset.relativePath());
    }

    private void purgeContextIconAsset(ContextIconAsset iconAsset) {
        deleteContextIconAssetFile(iconAsset);
        contextIconAssetRepository.delete(iconAsset);
    }

    private void deleteContextIconAssetFile(ContextIconAsset iconAsset) {
        assetStorageService.deleteAsset(iconAsset.relativePath());
    }

    private void purgeContext(Context context) {
        UUID contextId = context.getId();
        contextIconAssetRepository.findAllByContextId(contextId).forEach(this::deleteContextIconAssetFile);
        nextActionRepository.deleteContextLinksForContext(contextId);
        contextRepository.delete(context);
    }

    private void markCleanupCompleted(Instant now) {
        MaintenanceRun run = maintenanceRunRepository.findById(CLEANUP_NAME)
            .orElse(new MaintenanceRun(CLEANUP_NAME, now));
        run.markCompletedAt(now);
        maintenanceRunRepository.save(run);
    }
}
