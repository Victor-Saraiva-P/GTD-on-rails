package com.gtdonrails.api.normalizers;

import java.nio.file.Path;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AssetPathNormalizer {

    public String normalizeCapturedPath(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            throw new IllegalArgumentException("asset path is required");
        }

        return normalize(relativePath.startsWith("/") ? relativePath.substring(1) : relativePath);
    }

    public String normalize(String relativePath) {
        if (!StringUtils.hasText(relativePath)) {
            throw new IllegalArgumentException("asset path is required");
        }

        Path rawPath = Path.of(relativePath);
        if (rawPath.isAbsolute() || relativePath.contains("..")) {
            throw new IllegalArgumentException("asset path is invalid");
        }

        return relativePath;
    }
}
