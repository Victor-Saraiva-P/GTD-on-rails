package com.gtdonrails.api.normalizers;

import java.nio.file.Path;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AssetPathNormalizer {

    /**
     * Normalizes a path captured by Spring's wildcard path variable.
     *
     * <p>Example: {@code assetPathNormalizer.normalizeCapturedPath("/contexts/id/icon.png")}.</p>
     */
    public String normalizeCapturedPath(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            throw new IllegalArgumentException("asset path value '" + relativePath + "' is invalid; expected relative path");
        }

        return normalize(relativePath.startsWith("/") ? relativePath.substring(1) : relativePath);
    }

    /**
     * Validates and returns an asset path relative to the asset root.
     *
     * <p>Example: {@code assetPathNormalizer.normalize("contexts/id/icon.png")}.</p>
     */
    public String normalize(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            throw new IllegalArgumentException("asset path value '" + relativePath + "' is invalid; expected relative path");
        }

        Path rawPath = Path.of(relativePath);
        if (rawPath.isAbsolute() || relativePath.contains("..")) {
            throw new IllegalArgumentException(
                "asset path value '" + relativePath + "' is invalid; expected relative path without parent traversal");
        }

        return relativePath;
    }
}
