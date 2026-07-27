package com.gtdonrails.api.services;

import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("dev")
public class DevelopmentDataCleaner {

    private final AssetStorageService assetStorageService;
    private final CalendarRepository calendarRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final ContextRepository contextRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ItemRepository itemRepository;
    private final NextActionRepository nextActionRepository;

    public DevelopmentDataCleaner(
        AssetStorageService assetStorageService,
        CalendarRepository calendarRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        ContextRepository contextRepository,
        ItemAssetRepository itemAssetRepository,
        ItemRepository itemRepository,
        NextActionRepository nextActionRepository
    ) {
        this.assetStorageService = assetStorageService;
        this.calendarRepository = calendarRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.contextRepository = contextRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.itemRepository = itemRepository;
        this.nextActionRepository = nextActionRepository;
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
        nextActionRepository.findAll().forEach(nextAction -> nextActionRepository.deleteContextLinks(nextAction.getItemId()));
        calendarRepository.deleteAll();
        nextActionRepository.deleteAll();
        itemAssetRepository.deleteAll();
        contextIconAssetRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    private void deleteItemAsset(ItemAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }

    private void deleteContextIconAsset(ContextIconAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }
}
