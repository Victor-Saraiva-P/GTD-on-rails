package com.gtdonrails.api.services;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.config.CleanupProperties;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.entities.MaintenanceRun;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.MaintenanceRunRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class DeletedDataCleanupServiceTests {

    private static final Instant NOW = Instant.parse("2026-05-18T10:00:00Z");

    @Mock
    private MaintenanceRunRepository maintenanceRunRepository;

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private NextActionRepository nextActionRepository;

    @Mock
    private ItemAssetRepository itemAssetRepository;

    @Mock
    private ContextIconAssetRepository contextIconAssetRepository;

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private AssetStorageService assetStorageService;

    private DeletedDataCleanupService cleanupService;

    @BeforeEach
    void setUp() {
        cleanupService = new DeletedDataCleanupService(
            cleanupProperties(), maintenanceRunRepository, itemRepository, nextActionRepository,
            itemAssetRepository, contextIconAssetRepository, contextRepository, assetStorageService, fixedClock());
    }

    @Test
    void skipsCleanupWhenLastRunIsRecent() {
        MaintenanceRun run = new MaintenanceRun("deleted-data-cleanup", NOW.minus(Duration.ofDays(1)));
        when(maintenanceRunRepository.findById("deleted-data-cleanup")).thenReturn(Optional.of(run));

        cleanupService.runIfDue();

        verify(itemAssetRepository, never()).findAllByDeletedAtLessThanEqual(NOW.minus(Duration.ofDays(30)));
    }

    @Test
    void purgesExpiredItemAssetsWithoutDeletingItem() {
        ItemAsset asset = itemAsset(item(UUID.randomUUID()), "old.pdf");
        stubCleanupDue();
        stubEmptyPurgeQueries();
        when(itemAssetRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of(asset));

        cleanupService.runIfDue();

        verify(assetStorageService).deleteAsset(asset.relativePath());
        verify(itemAssetRepository).delete(asset);
        verify(itemRepository, never()).delete(asset.getItem());
    }

    @Test
    void purgesExpiredContextIconAssets() {
        ContextIconAsset iconAsset = contextIconAsset(context(UUID.randomUUID()), "icon.png");
        stubCleanupDue();
        stubEmptyPurgeQueries();
        when(contextIconAssetRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of(iconAsset));

        cleanupService.runIfDue();

        verify(assetStorageService).deleteAsset(iconAsset.relativePath());
        verify(contextIconAssetRepository).delete(iconAsset);
    }

    @Test
    void purgesExpiredDeletedContextsWithAssetsAndLinks() {
        Context context = context(UUID.randomUUID());
        ContextIconAsset iconAsset = contextIconAsset(context, "icon.png");
        stubCleanupDue();
        stubEmptyPurgeQueries();
        when(contextRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of(context));
        when(contextIconAssetRepository.findAllByContextId(context.getId())).thenReturn(List.of(iconAsset));

        cleanupService.runIfDue();

        verify(assetStorageService).deleteAsset(iconAsset.relativePath());
        verify(nextActionRepository).deleteContextLinksForContext(context.getId());
        verify(contextRepository).delete(context);
    }

    @Test
    void purgesExpiredDeletedItemWithNextActionAndAssets() {
        Item item = item(UUID.randomUUID());
        ItemAsset asset = itemAsset(item, "old.png");
        NextAction nextAction = nextAction(item);
        stubCleanupDue();
        stubEmptyPurgeQueries();
        when(itemRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of(item));
        when(itemAssetRepository.findAllByItemId(item.getId())).thenReturn(List.of(asset));

        cleanupService.runIfDue();

        verify(nextActionRepository).deleteContextLinks(item.getId());
        verify(itemRepository).delete(item);
        verify(assetStorageService).deleteAsset(asset.relativePath());
    }

    @Test
    void purgesExpiredDoneNextActionByDateEnd() {
        Item item = item(UUID.randomUUID());
        NextAction nextAction = nextAction(item);
        stubCleanupDue();
        stubEmptyPurgeQueries();
        when(nextActionRepository.findAllDoneBeforeDate(NextActionStatus.DONE, cutoffDate())).thenReturn(List.of(nextAction));

        cleanupService.runIfDue();

        verify(nextActionRepository).deleteContextLinks(item.getId());
        verify(itemRepository).delete(item);
    }

    private void stubCleanupDue() {
        when(maintenanceRunRepository.findById("deleted-data-cleanup")).thenReturn(Optional.empty());
    }

    private void stubEmptyPurgeQueries() {
        when(itemAssetRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of());
        when(contextIconAssetRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of());
        when(contextRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of());
        when(itemRepository.findAllByDeletedAtLessThanEqual(cutoffInstant())).thenReturn(List.of());
        when(nextActionRepository.findAllDoneBeforeDate(NextActionStatus.DONE, cutoffDate())).thenReturn(List.of());
    }

    private Item item(UUID id) {
        Item item = new Item(new Title("Capture idea"), null);
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private Context context(UUID id) {
        Context context = new Context("home");
        ReflectionTestUtils.setField(context, "id", id);
        return context;
    }

    private ContextIconAsset contextIconAsset(Context context, String fileName) {
        ContextIconAsset asset = new ContextIconAsset(context, fileName, fileName, "image/png", 10);
        ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
        return asset;
    }

    private ItemAsset itemAsset(Item item, String fileName) {
        return new ItemAsset(item, fileName, fileName, "application/pdf", 10);
    }

    private NextAction nextAction(Item item) {
        NextAction nextAction = item.convertToNextAction(BigDecimal.ONE, Duration.ZERO, Set.of());
        ReflectionTestUtils.setField(nextAction, "itemId", item.getId());
        nextAction.markDone(fixedClock());
        return nextAction;
    }

    private CleanupProperties cleanupProperties() {
        CleanupProperties properties = new CleanupProperties();
        properties.setRetentionDays(30);
        return properties;
    }

    private Clock fixedClock() {
        return Clock.fixed(NOW, ZoneOffset.UTC);
    }

    private Instant cutoffInstant() {
        return NOW.minus(Duration.ofDays(30));
    }

    private LocalDate cutoffDate() {
        return LocalDate.now(fixedClock()).minusDays(30);
    }
}
