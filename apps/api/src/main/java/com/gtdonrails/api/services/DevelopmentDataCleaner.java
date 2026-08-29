package com.gtdonrails.api.services;

import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({"dev", "staging-reset"})
public class DevelopmentDataCleaner {

    private final AssetStorageService assetStorageService;
    private final CalendarRepository calendarRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final ContextRepository contextRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ItemRepository itemRepository;
    private final NextActionRepository nextActionRepository;
    private final ProjectItemRepository projectItemRepository;
    private final ProjectRepository projectRepository;
    private final CacheInvalidationService cacheInvalidationService;

    public DevelopmentDataCleaner(
        AssetStorageService assetStorageService,
        CalendarRepository calendarRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        ContextRepository contextRepository,
        ItemAssetRepository itemAssetRepository,
        ItemRepository itemRepository,
        NextActionRepository nextActionRepository,
        ProjectItemRepository projectItemRepository,
        ProjectRepository projectRepository,
        CacheInvalidationService cacheInvalidationService
    ) {
        this.assetStorageService = assetStorageService;
        this.calendarRepository = calendarRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.contextRepository = contextRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.itemRepository = itemRepository;
        this.nextActionRepository = nextActionRepository;
        this.projectItemRepository = projectItemRepository;
        this.projectRepository = projectRepository;
        this.cacheInvalidationService = cacheInvalidationService;
    }

    /**
     * Deletes all development GTD rows and their persisted assets.
     *
     * <p>Example: {@code developmentDataCleaner.deleteAll()}.</p>
     */
    @Transactional
    public void deleteAll() {
        itemAssetRepository.findAll().forEach(this::deleteItemAsset);
        contextIconAssetRepository.findAll().forEach(this::deleteContextIconAsset);
        nextActionRepository.deleteAllContextLinks();
        calendarRepository.deleteAllInBatch();
        nextActionRepository.deleteAllInBatch();
        projectItemRepository.deleteAllInBatch();
        projectRepository.deleteAllInBatch();
        itemAssetRepository.deleteAllInBatch();
        contextIconAssetRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        contextRepository.deleteAllInBatch();
        cacheInvalidationService.evictAll();
    }

    private void deleteItemAsset(ItemAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }

    private void deleteContextIconAsset(ContextIconAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }
}
