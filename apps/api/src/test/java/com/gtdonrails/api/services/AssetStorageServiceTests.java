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
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

@Tag("unit")
class AssetStorageServiceTests {

    @TempDir
    private Path tempDir;

    @Test
    void rejectsParentDirectoryTraversal() {
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.loadAsResource("../application.properties")
        );

        assertEquals(
            "asset path value '../application.properties' is invalid; expected relative path without parent traversal",
            exception.getMessage());
    }

    @Test
    void rejectsAbsolutePaths() {
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.loadAsResource(tempDir.resolve("secret.txt").toString())
        );

        assertEquals(
            "asset path value '" + tempDir.resolve("secret.txt") + "' is invalid; expected relative path without parent traversal",
            exception.getMessage());
    }

    @Test
    void storesImageAssetInExpectedPath() throws IOException {
        UUID contextId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});
        AssetStorageService assetStorageService = newAssetStorageService();
        String relativePath = "contexts/" + contextId + "/" + assetId + "/icon.png";

        assetStorageService.storeImageAsset(relativePath, file);

        Path storedFile = tempDir.resolve("assets").resolve(relativePath);
        assertTrue(Files.exists(storedFile));
        assertEquals(new byte[] {1, 2, 3}.length, Files.readAllBytes(storedFile).length);
    }

    @Test
    void rejectsEmptyImageAsset() {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[0]);
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeImageAsset("contexts/" + contextId + "/asset/icon.png", file)
        );

        assertEquals(
            "image asset file value '" + file + "' is invalid; expected non-empty MultipartFile",
            exception.getMessage());
    }

    @Test
    void rejectsInvalidImageAssetType() {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.txt", "text/plain", new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeImageAsset("contexts/" + contextId + "/asset/icon.txt", file)
        );

        assertEquals("image asset file extension 'txt' is invalid; expected png, jpg, jpeg, gif, webp, or svg", exception.getMessage());
    }

    @Test
    void rejectsImageAssetDestinationTraversal() {
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeImageAsset("../icon.png", file));

        assertEquals(
            "asset path value '../icon.png' is invalid; expected relative path without parent traversal",
            exception.getMessage());
    }

    @Test
    void storesItemAssetInExpectedPath() throws IOException {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", new byte[] {1, 2, 3});
        AssetStorageService assetStorageService = newAssetStorageService();
        String relativePath = "items/" + itemId + "/" + assetId + "/report.pdf";

        assetStorageService.storeItemAsset(relativePath, file);

        assertTrue(Files.exists(tempDir.resolve("assets").resolve(relativePath)));
    }

    @Test
    void rejectsItemAssetDestinationTraversal() {
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeItemAsset("../report.pdf", file));

        assertEquals(
            "asset path value '../report.pdf' is invalid; expected relative path without parent traversal",
            exception.getMessage());
    }

    @Test
    void copiesLocalItemAssetInExpectedPath() throws IOException {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        Path sourcePath = tempDir.resolve("Engage mint vitória.pdf");
        Files.write(sourcePath, new byte[] {1, 2, 3});
        AssetStorageService assetStorageService = newAssetStorageService();
        String fileName = assetStorageService.itemAssetFileName(sourcePath.getFileName().toString());
        String relativePath = "items/" + itemId + "/" + assetId + "/" + fileName;

        assetStorageService.copyLocalItemAsset(relativePath, sourcePath);

        assertEquals("Engage-mint-vit-ria.pdf", fileName);
        assertTrue(Files.exists(tempDir.resolve("assets").resolve(relativePath)));
    }

    @Test
    void rejectsInvalidLocalItemAssetType() throws IOException {
        UUID itemId = UUID.randomUUID();
        Path sourcePath = tempDir.resolve("script.sh");
        Files.write(sourcePath, new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.copyLocalItemAsset("items/" + itemId + "/asset/script.sh", sourcePath));

        assertEquals("item asset file extension 'sh' is invalid; expected pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, webp, or svg", exception.getMessage());
    }

    @Test
    void rejectsLocalItemAssetDestinationTraversal() throws IOException {
        Path sourcePath = tempDir.resolve("report.pdf");
        Files.write(sourcePath, new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.copyLocalItemAsset("../report.pdf", sourcePath));

        assertEquals(
            "asset path value '../report.pdf' is invalid; expected relative path without parent traversal",
            exception.getMessage());
    }

    @Test
    void rejectsEmptyItemAsset() {
        UUID itemId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "file.pdf", "application/pdf", new byte[0]);
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeItemAsset("items/" + itemId + "/asset/file.pdf", file));

        assertEquals("item asset file value '" + file + "' is invalid; expected non-empty MultipartFile", exception.getMessage());
    }

    @Test
    void rejectsInvalidItemAssetType() {
        UUID itemId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "script.sh", "text/x-shellscript", new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> assetStorageService.storeItemAsset("items/" + itemId + "/asset/script.sh", file));

        assertEquals("item asset file extension 'sh' is invalid; expected pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, webp, or svg", exception.getMessage());
    }

    @Test
    void sanitizesItemAssetFileName() {
        MockMultipartFile file = new MockMultipartFile("file", "bad name.pdf", "application/pdf", new byte[] {1});
        AssetStorageService assetStorageService = newAssetStorageService();

        String fileName = assetStorageService.itemAssetFileName(file);

        assertEquals("bad-name.pdf", fileName);
    }

    @Test
    void deletesExistingAsset() throws IOException {
        Path assetFile = tempDir.resolve("assets/contexts/context-id/icon.png");
        Files.createDirectories(assetFile.getParent());
        Files.writeString(assetFile, "icon");
        AssetStorageService assetStorageService = newAssetStorageService();

        assetStorageService.deleteAsset("contexts/context-id/icon.png");

        assertFalse(Files.exists(assetFile));
    }

    @Test
    void loadsExistingAssetAsResource() throws IOException {
        Path assetFile = tempDir.resolve("assets/contexts/context-id/icon.png");
        Files.createDirectories(assetFile.getParent());
        Files.writeString(assetFile, "icon");
        AssetStorageService assetStorageService = newAssetStorageService();

        Resource resource = assetStorageService.loadAsResource("contexts/context-id/icon.png");

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
        AssetStorageService assetStorageService = newAssetStorageService();

        assertThrows(IllegalArgumentException.class, () -> assetStorageService.loadAsResource("secret-link.txt"));
    }

    @Test
    void resolvesKnownMediaType() {
        AssetStorageService assetStorageService = newAssetStorageService();

        assertEquals(MediaType.IMAGE_PNG, assetStorageService.mediaType("contexts/context-id/icon.png"));
    }

    @Test
    void fallsBackToOctetStreamForUnknownMediaType() {
        AssetStorageService assetStorageService = newAssetStorageService();

        assertEquals(MediaType.APPLICATION_OCTET_STREAM, assetStorageService.mediaType("contexts/context-id/icon.bin"));
    }

    @Test
    void buildsPublicUrl() {
        AssetStorageService assetStorageService = newAssetStorageService();

        assertEquals("/assets/contexts/context-id/icon.png", assetStorageService.publicUrl("contexts/context-id/icon.png"));
    }

    @Test
    void returnsNullPublicUrlWhenRelativePathIsBlank() {
        AssetStorageService assetStorageService = newAssetStorageService();

        assertNull(assetStorageService.publicUrl(" "));
    }

    private AssetsProperties properties() {
        AssetsProperties properties = new AssetsProperties();
        properties.setLocalDirectory(tempDir.resolve("assets").toString());
        return properties;
    }

    private AssetStorageService newAssetStorageService() {
        return new AssetStorageService(properties(), new AssetPathNormalizer());
    }
}
