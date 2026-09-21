package com.gtdonrails.api.bodydocuments;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LegacyItemAssetLayoutMigrator {

    private final ItemAssetRepository repository;
    private final Path dataRoot;

    public LegacyItemAssetLayoutMigrator(
        ItemAssetRepository repository,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.repository = repository;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    /**
     * Copies legacy item assets into the new item-local layout without deleting legacy files.
     *
     * <p>Example: {@code migrator.migrate()}.</p>
     */
    public AssetMigrationReport migrate() {
        int copied = 0;
        int existing = 0;
        int missing = 0;
        for (ItemAsset asset : repository.findAll()) {
            MigrationOutcome outcome = migrateAsset(asset);
            copied += outcome == MigrationOutcome.COPIED ? 1 : 0;
            existing += outcome == MigrationOutcome.EXISTING ? 1 : 0;
            missing += outcome == MigrationOutcome.MISSING ? 1 : 0;
        }
        return new AssetMigrationReport(copied, existing, missing);
    }

    private MigrationOutcome migrateAsset(ItemAsset asset) {
        Path target = dataRoot.resolve(asset.relativePath()).normalize();
        if (Files.isRegularFile(target)) return MigrationOutcome.EXISTING;
        Path source = legacyPath(asset);
        if (!Files.isRegularFile(source)) return MigrationOutcome.MISSING;
        copy(source, target);
        return MigrationOutcome.COPIED;
    }

    private Path legacyPath(ItemAsset asset) {
        return dataRoot.resolve("assets")
            .resolve("items")
            .resolve(asset.getItem().getId().toString())
            .resolve(asset.getId().toString())
            .resolve(asset.getFileName())
            .normalize();
    }

    private void copy(Path source, Path target) {
        try {
            Files.createDirectories(target.getParent());
            Files.copy(source, target, StandardCopyOption.COPY_ATTRIBUTES);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to migrate item asset from '" + source + "' to '" + target + "'",
                exception
            );
        }
    }

    private enum MigrationOutcome {
        COPIED,
        EXISTING,
        MISSING
    }
}
