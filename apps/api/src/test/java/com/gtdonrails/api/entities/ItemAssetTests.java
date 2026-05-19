package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@Tag("unit")
class ItemAssetTests {

    @Test
    void derivesRelativePathFromItemAssetAndFileName() {
        UUID itemId = UUID.randomUUID();
        ItemAsset asset = newItemAsset(itemId, "report.pdf", "application/pdf");

        assertEquals("items/" + itemId + "/" + asset.getId() + "/report.pdf", asset.relativePath());
    }

    @Test
    void derivesPublicUrlFromBasePath() {
        UUID itemId = UUID.randomUUID();
        ItemAsset asset = newItemAsset(itemId, "report.pdf", "application/pdf");

        assertEquals("/assets/items/" + itemId + "/" + asset.getId() + "/report.pdf", asset.publicUrl("/assets/"));
    }

    @Test
    void detectsImageFromPersistedContentType() {
        assertTrue(newItemAsset(UUID.randomUUID(), "image.png", "image/png").isImage());
        assertFalse(newItemAsset(UUID.randomUUID(), "report.pdf", "application/pdf").isImage());
    }

    private ItemAsset newItemAsset(UUID itemId, String fileName, String contentType) {
        Item item = new Item(new Title("Capture idea"), null);
        ReflectionTestUtils.setField(item, "id", itemId);
        return new ItemAsset(item, fileName, fileName, contentType, 1L);
    }
}
