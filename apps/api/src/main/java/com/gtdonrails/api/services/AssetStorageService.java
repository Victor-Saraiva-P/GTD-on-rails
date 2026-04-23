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
    private static final Map<String, MediaType> MEDIA_TYPES = Map.of(
        "png", MediaType.IMAGE_PNG,
        "svg", MediaType.valueOf("image/svg+xml"),
        "webp", MediaType.valueOf("image/webp")
    );

    private final AssetsProperties properties;
    private final AssetPathNormalizer assetPathNormalizer;

    public AssetStorageService(AssetsProperties properties, AssetPathNormalizer assetPathNormalizer) {
        this.properties = properties;
        this.assetPathNormalizer = assetPathNormalizer;
    }

    public String storeContextIcon(UUID contextId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("icon file is required");
        }

        String extension = validateIconFile(file);
        String relativePath = "contexts/" + contextId + "/icon." + extension;
        Path destination = resolveRelativePath(relativePath);

        try {
            Files.createDirectories(destination.getParent());
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to store context icon", exception);
        }

        return relativePath;
    }

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

    public Resource loadAsResource(String relativePath) {
        Path path = resolveRelativePath(relativePath);
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException("asset not found");
        }

        try {
            return new UrlResource(path.toUri());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load asset", exception);
        }
    }

    public MediaType mediaType(String relativePath) {
        String extension = extensionOf(relativePath);
        return MEDIA_TYPES.getOrDefault(extension, MediaType.APPLICATION_OCTET_STREAM);
    }

    public String publicUrl(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            return null;
        }

        String basePath = properties.getPublicBasePath().endsWith("/")
            ? properties.getPublicBasePath().substring(0, properties.getPublicBasePath().length() - 1)
            : properties.getPublicBasePath();
        return basePath + "/" + relativePath;
    }

    private String validateIconFile(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_ICON_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("icon file must be PNG, SVG or WebP");
        }

        String contentType = file.getContentType();
        if (!isAllowedIconContentType(extension, contentType)) {
            throw new IllegalArgumentException("icon file must be PNG, SVG or WebP");
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

    private Path resolveRelativePath(String relativePath) {
        String normalizedRelativePath = assetPathNormalizer.normalize(relativePath);

        Path baseDirectory = localDirectory();
        Path resolvedPath = baseDirectory.resolve(normalizedRelativePath).normalize();
        if (!resolvedPath.startsWith(baseDirectory)) {
            throw new IllegalArgumentException("asset path is invalid");
        }

        return resolvedPath;
    }

    private Path localDirectory() {
        return Path.of(properties.getLocalDirectory()).toAbsolutePath().normalize();
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
