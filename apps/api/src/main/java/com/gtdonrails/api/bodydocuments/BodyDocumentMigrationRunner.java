package com.gtdonrails.api.bodydocuments;

import com.gtdonrails.api.repositories.ItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    name = "gtd.body-documents.migrate-on-startup",
    havingValue = "true",
    matchIfMissing = true
)
public class BodyDocumentMigrationRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(BodyDocumentMigrationRunner.class);

    private final ItemRepository itemRepository;
    private final ItemBodyDocumentService bodyDocuments;
    private final LegacyItemAssetLayoutMigrator assetMigrator;

    public BodyDocumentMigrationRunner(
        ItemRepository itemRepository,
        ItemBodyDocumentService bodyDocuments,
        LegacyItemAssetLayoutMigrator assetMigrator
    ) {
        this.itemRepository = itemRepository;
        this.bodyDocuments = bodyDocuments;
        this.assetMigrator = assetMigrator;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        AssetMigrationReport assets = assetMigrator.migrate();
        int migrated = itemRepository.findAll().stream()
            .mapToInt(item -> bodyDocuments.migrate(item.getId(), item.getBody()) ? 1 : 0)
            .sum();
        logger.atInfo()
            .addKeyValue("event", "body_document_migration_completed")
            .addKeyValue("migratedBodies", migrated)
            .addKeyValue("copiedAssets", assets.copied())
            .addKeyValue("existingAssets", assets.alreadyPresent())
            .addKeyValue("missingAssets", assets.missing())
            .log("Completed file-backed item content migration");
    }
}
