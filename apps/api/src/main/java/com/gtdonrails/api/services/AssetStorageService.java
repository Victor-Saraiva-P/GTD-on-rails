package com.gtdonrails.api.services;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import com.gtdonrails.api.config.AssetsProperties;
import com.gtdonrails.api.normalizers.AssetPathNormalizer;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AssetStorageService {

    private static final Set<String> ALLOWED_ICON_EXTENSIONS = Set.of("png", "svg", "webp");
    private static final Set<String> ALLOWED_ITEM_ASSET_EXTENSIONS = Set.of(
        "pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "gif", "webp", "svg"
    );
    private static final Map<String, MediaType> MEDIA_TYPES = Map.of(
        "png", MediaType.IMAGE_PNG,
        "svg", MediaType.valueOf("image/svg+xml"),
        "webp", MediaType.valueOf("image/webp"),
        "jpg", MediaType.IMAGE_JPEG,
        "jpeg", MediaType.IMAGE_JPEG,
        "gif", MediaType.IMAGE_GIF,
        "pdf", MediaType.APPLICATION_PDF
    );
    private static final Pattern UNSAFE_FILENAME_CHARACTERS = Pattern.compile("[^a-zA-Z0-9._-]");

    private final AssetsProperties assetsProperties;
    private final AssetPathNormalizer assetPathNormalizer;

    public AssetStorageService(AssetsProperties assetsProperties, AssetPathNormalizer assetPathNormalizer) {
        this.assetsProperties = assetsProperties;
        this.assetPathNormalizer = assetPathNormalizer;
    }

    /**
     * Stores a context icon under the configured asset directory.
     *
     * <p>Example: {@code assetStorageService.storeContextIcon(contextId, file)}.</p>
     */
    public String storeContextIcon(UUID contextId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("icon file value '" + file + "' is invalid; expected non-empty MultipartFile");
        }

        String extension = validateIconFile(file);
        String relativePath = "contexts/" + contextId + "/icon." + extension;
        Path destination = resolveRelativePath(relativePath);

        writeAssetFile(file, destination);
        return relativePath;
    }

    /**
     * Stores an item attachment under the configured asset directory.
     *
     * <p>Example: {@code assetStorageService.storeItemAsset(itemId, file)}.</p>
     */
    public String storeItemAsset(UUID itemId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("item asset file value '" + file + "' is invalid; expected non-empty MultipartFile");
        }

        validateItemAssetFile(file);
        String relativePath = itemAssetRelativePath(itemId, file);
        writeAssetFile(file, resolveRelativePath(relativePath));
        return relativePath;
    }

    /**
     * Copies a local item attachment under the configured asset directory.
     *
     * <p>Example: {@code assetStorageService.copyLocalItemAsset(itemId, Path.of("/tmp/file.pdf"))}.</p>
     */
    public String copyLocalItemAsset(UUID itemId, Path sourcePath) {
        validateLocalItemAssetFile(sourcePath);
        String relativePath = itemAssetRelativePath(itemId, sourcePath.getFileName().toString());
        writeLocalAssetFile(sourcePath, resolveRelativePath(relativePath));
        return relativePath;
    }

    private void writeAssetFile(MultipartFile file, Path destination) {
        try {
            Files.createDirectories(destination.getParent());
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to store context icon", exception);
        }
    }

    private void writeLocalAssetFile(Path sourcePath, Path destination) {
        try {
            Files.createDirectories(destination.getParent());
            Files.copy(sourcePath, destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to copy local item asset", exception);
        }
    }

    /**
     * Deletes an asset when the relative path is present.
     *
     * <p>Example: {@code assetStorageService.deleteAsset("contexts/id/icon.png")}.</p>
     */
    public void deleteAsset(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            return;
        }

        try {
            Files.deleteIfExists(resolveRelativePath(relativePath));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to delete asset", exception);
        }

    }

    /**
     * Loads a stored asset as a Spring resource for HTTP responses.
     *
     * <p>Example: {@code assetStorageService.loadAsResource("contexts/id/icon.png")}.</p>
     */
    public Resource loadAsResource(String relativePath) {
        Path path = resolveRelativePath(relativePath);
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException(
                "asset path value '" + relativePath + "' is invalid; expected existing regular file");
        }

        try {
            return new UrlResource(path.toUri());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load asset", exception);
        }
    }

    /**
     * Resolves the HTTP media type for a stored asset path.
     *
     * <p>Example: {@code assetStorageService.mediaType("contexts/id/icon.png")}.</p>
     */
    public MediaType mediaType(String relativePath) {
        String extension = extensionOf(relativePath);
        return MEDIA_TYPES.getOrDefault(extension, MediaType.APPLICATION_OCTET_STREAM);
    }

    /**
     * Resolves the original filename stored at the end of an asset-relative path.
     *
     * <p>Example: {@code assetStorageService.fileName("items/id/a/file.pdf")}.</p>
     */
    public String fileName(String relativePath) {
        return Path.of(relativePath).getFileName().toString();
    }

    /**
     * Detects whether an asset-relative path points to a supported image type.
     *
     * <p>Example: {@code assetStorageService.isImage("items/id/a/image.png")}.</p>
     */
    public boolean isImage(String relativePath) {
        return mediaType(relativePath).getType().equals("image");
    }

    /**
     * Builds the public URL for an asset-relative path.
     *
     * <p>Example: {@code assetStorageService.publicUrl("contexts/id/icon.png")}.</p>
     */
    public String publicUrl(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            return null;
        }

        String basePath = assetsProperties.getPublicBasePath().endsWith("/")
            ? assetsProperties.getPublicBasePath().substring(0, assetsProperties.getPublicBasePath().length() - 1)
            : assetsProperties.getPublicBasePath();
        return basePath + "/" + relativePath;
    }

    private String validateIconFile(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_ICON_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                "icon file extension '" + extension + "' is invalid; expected png, svg, or webp");
        }

        String contentType = file.getContentType();
        if (!isAllowedIconContentType(extension, contentType)) {
            throw new IllegalArgumentException(
                "icon file content type '" + contentType + "' is invalid; expected image/" + extension);
        }

        return extension;
    }

    private boolean isAllowedIconContentType(String extension, String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return false;
        }

        String normalizedContentType = contentType.toLowerCase(Locale.ROOT);
        return switch (extension) {
            case "png" -> normalizedContentType.equals("image/png");
            case "svg" -> normalizedContentType.equals("image/svg+xml");
            case "webp" -> normalizedContentType.equals("image/webp");
            default -> false;
        };
    }

    private String itemAssetRelativePath(UUID itemId, MultipartFile file) {
        return itemAssetRelativePath(itemId, safeAssetFileName(file));
    }

    private String itemAssetRelativePath(UUID itemId, String fileName) {
        return "items/" + itemId + "/" + UUID.randomUUID() + "/" + safeAssetFileName(fileName);
    }

    private String safeAssetFileName(MultipartFile file) {
        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "asset" : file.getOriginalFilename());
        return safeAssetFileName(originalFileName);
    }

    private String safeAssetFileName(String originalFileName) {
        String safeFileName = UNSAFE_FILENAME_CHARACTERS.matcher(originalFileName).replaceAll("-");
        return StringUtils.hasText(safeFileName) ? safeFileName : "asset." + extensionOf(originalFileName);
    }

    private void validateItemAssetFile(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_ITEM_ASSET_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                "item asset file extension '" + extension + "' is invalid; expected pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, webp, or svg");
        }
    }

    private void validateLocalItemAssetFile(Path sourcePath) {
        if (sourcePath == null || !Files.isRegularFile(sourcePath, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException("item asset source path value '" + sourcePath + "' is invalid; expected existing regular file");
        }
        validateLocalItemAssetSize(sourcePath);
        validateItemAssetExtension(sourcePath.getFileName().toString());
    }

    private void validateLocalItemAssetSize(Path sourcePath) {
        try {
            if (Files.size(sourcePath) <= 0) {
                throw new IllegalArgumentException("item asset source path value '" + sourcePath + "' is invalid; expected non-empty file");
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("item asset source path value '" + sourcePath + "' is invalid; expected readable file size", exception);
        }
    }

    private void validateItemAssetExtension(String fileName) {
        String extension = extensionOf(fileName);
        if (!ALLOWED_ITEM_ASSET_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                "item asset file extension '" + extension + "' is invalid; expected pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, webp, or svg");
        }
    }

    private Path resolveRelativePath(String relativePath) {
        String normalizedRelativePath = assetPathNormalizer.normalize(relativePath);

        Path baseDirectory = localDirectory();
        Path resolvedPath = baseDirectory.resolve(normalizedRelativePath).normalize();
        if (!resolvedPath.startsWith(baseDirectory)) {
            throw new IllegalArgumentException(
                "asset path value '" + relativePath + "' is invalid; expected path inside " + baseDirectory);
        }

        return resolvedPath;
    }

    private Path localDirectory() {
        return Path.of(assetsProperties.getLocalDirectory()).toAbsolutePath().normalize();
    }

    private String extensionOf(String filename) {
        if (!StringUtils.hasText(filename)) {
            return "";
        }

        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }

        return filename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

}
