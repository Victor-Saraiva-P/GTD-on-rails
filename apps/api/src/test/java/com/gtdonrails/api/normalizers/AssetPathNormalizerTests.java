package com.gtdonrails.api.normalizers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class AssetPathNormalizerTests {

    private final AssetPathNormalizer assetPathNormalizer = new AssetPathNormalizer();

    @Test
    void removesLeadingSlashFromCapturedPath() {
        String normalizedPath = assetPathNormalizer.normalizeCapturedPath("/contexts/context-id/icon.png");

        assertEquals("contexts/context-id/icon.png", normalizedPath);
    }

    @Test
    void rejectsAbsolutePath() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetPathNormalizer.normalize("/tmp/secret.txt")
        );

        assertEquals("asset path is invalid", exception.getMessage());
    }

    @Test
    void keepsRelativePathWithoutLeadingSlash() {
        String normalizedPath = assetPathNormalizer.normalize("contexts/context-id/icon.png");

        assertEquals("contexts/context-id/icon.png", normalizedPath);
    }

    @Test
    void rejectsBlankPath() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetPathNormalizer.normalize(" ")
        );

        assertEquals("asset path is required", exception.getMessage());
    }

    @Test
    void rejectsPathTraversal() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetPathNormalizer.normalize("../application.properties")
        );

        assertEquals("asset path is invalid", exception.getMessage());
    }

    @Test
    void rejectsNestedPathTraversal() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetPathNormalizer.normalize("contexts/../application.properties")
        );

        assertEquals("asset path is invalid", exception.getMessage());
    }
}
