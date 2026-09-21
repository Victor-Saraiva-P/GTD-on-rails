package com.gtdonrails.api.bodydocuments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

class LegacyItemAssetLayoutMigratorTests {

    @TempDir
    Path dataRoot;

    @Test
    void copiesLegacyItemAssetIntoItemLocalAssetsDirectory() throws Exception {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        Item item = new Item(new Title("Item"), null);
        ReflectionTestUtils.setField(item, "id", itemId);
        ItemAsset asset = new ItemAsset(item, "diagram.png", "diagram.png", "image/png", 3);
        ReflectionTestUtils.setField(asset, "id", assetId);
        Path oldPath = dataRoot.resolve("assets/items")
            .resolve(itemId.toString()).resolve(assetId.toString()).resolve("diagram.png");
        Files.createDirectories(oldPath.getParent());
        Files.write(oldPath, new byte[] {1, 2, 3});
        ItemAssetRepository repository = mock(ItemAssetRepository.class);
        when(repository.findAll()).thenReturn(List.of(asset));
        LegacyItemAssetLayoutMigrator migrator = new LegacyItemAssetLayoutMigrator(repository, dataRoot.toString());

        AssetMigrationReport report = migrator.migrate();

        Path newPath = dataRoot.resolve("items").resolve(itemId.toString())
            .resolve("assets").resolve(assetId.toString()).resolve("diagram.png");
        assertTrue(Files.isRegularFile(newPath));
        assertEquals(1, report.copied());
        assertEquals(0, report.missing());
    }

    @Test
    void reportsMissingSourceWithoutCreatingPlaceholder() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Item"), null);
        ReflectionTestUtils.setField(item, "id", itemId);
        ItemAsset asset = new ItemAsset(item, "missing.pdf", "missing.pdf", "application/pdf", 4);
        ItemAssetRepository repository = mock(ItemAssetRepository.class);
        when(repository.findAll()).thenReturn(List.of(asset));
        LegacyItemAssetLayoutMigrator migrator = new LegacyItemAssetLayoutMigrator(repository, dataRoot.toString());

        AssetMigrationReport report = migrator.migrate();

        assertEquals(1, report.missing());
        assertEquals(0, report.copied());
    }
}
