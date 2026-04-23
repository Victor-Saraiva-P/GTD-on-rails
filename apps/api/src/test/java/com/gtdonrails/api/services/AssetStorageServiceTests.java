package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.normalizers.AssetPathNormalizer;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

@Tag("unit")
class AssetStorageServiceTests {

    @TempDir
    private Path tempDir;

    @Test
    void rejectsParentDirectoryTraversal() {
        AssetStorageService service = service();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> service.loadAsResource("../application.properties")
        );

        assertEquals("asset path is invalid", exception.getMessage());
    }

    @Test
    void rejectsAbsolutePaths() {
        AssetStorageService service = service();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> service.loadAsResource(tempDir.resolve("secret.txt").toString())
        );

        assertEquals("asset path is invalid", exception.getMessage());
    }

    @Test
    void storesContextIconInExpectedPath() throws IOException {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});
        AssetStorageService service = service();

        String relativePath = service.storeContextIcon(contextId, file);

        assertEquals("contexts/" + contextId + "/icon.png", relativePath);
        Path storedFile = tempDir.resolve("assets").resolve(relativePath);
        assertTrue(Files.exists(storedFile));
        assertEquals(new byte[] {1, 2, 3}.length, Files.readAllBytes(storedFile).length);
    }

    @Test
    void rejectsEmptyContextIcon() {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[0]);
        AssetStorageService service = service();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> service.storeContextIcon(contextId, file)
        );

        assertEquals("icon file is required", exception.getMessage());
    }

    @Test
    void rejectsInvalidContextIconType() {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.txt", "text/plain", new byte[] {1});
        AssetStorageService service = service();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> service.storeContextIcon(contextId, file)
        );

        assertEquals("icon file must be PNG, SVG or WebP", exception.getMessage());
    }

    @Test
    void deletesExistingAsset() throws IOException {
        Path assetFile = tempDir.resolve("assets/contexts/context-id/icon.png");
        Files.createDirectories(assetFile.getParent());
        Files.writeString(assetFile, "icon");
        AssetStorageService service = service();

        service.deleteAsset("contexts/context-id/icon.png");

        assertFalse(Files.exists(assetFile));
    }

    @Test
    void loadsExistingAssetAsResource() throws IOException {
        Path assetFile = tempDir.resolve("assets/contexts/context-id/icon.png");
        Files.createDirectories(assetFile.getParent());
        Files.writeString(assetFile, "icon");
        AssetStorageService service = service();

        var resource = service.loadAsResource("contexts/context-id/icon.png");

        assertNotNull(resource);
        assertTrue(resource.exists());
    }

    @Test
    void rejectsSymlinks() throws IOException {
        Path secretFile = tempDir.resolve("secret.txt");
        Files.writeString(secretFile, "secret");
        Path assetDirectory = tempDir.resolve("assets");
        Files.createDirectories(assetDirectory);
        Files.createSymbolicLink(assetDirectory.resolve("secret-link.txt"), secretFile);
        AssetStorageService service = service();

        assertThrows(IllegalArgumentException.class, () -> service.loadAsResource("secret-link.txt"));
    }

    @Test
    void resolvesKnownMediaType() {
        AssetStorageService service = service();

        assertEquals(MediaType.IMAGE_PNG, service.mediaType("contexts/context-id/icon.png"));
    }

    @Test
    void fallsBackToOctetStreamForUnknownMediaType() {
        AssetStorageService service = service();

        assertEquals(MediaType.APPLICATION_OCTET_STREAM, service.mediaType("contexts/context-id/icon.bin"));
    }

    @Test
    void buildsPublicUrl() {
        AssetStorageService service = service();

        assertEquals("/assets/contexts/context-id/icon.png", service.publicUrl("contexts/context-id/icon.png"));
    }

    @Test
    void returnsNullPublicUrlWhenRelativePathIsBlank() {
        AssetStorageService service = service();

        assertNull(service.publicUrl(" "));
    }

    private AssetsProperties properties() {
        AssetsProperties properties = new AssetsProperties();
        properties.setLocalDirectory(tempDir.resolve("assets").toString());
        return properties;
    }

    private AssetStorageService service() {
        return new AssetStorageService(properties(), new AssetPathNormalizer());
    }
}
