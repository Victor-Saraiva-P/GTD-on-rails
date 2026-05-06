package com.gtdonrails.api.types;

/**
 * Optional block entity attributes mirrored from persisted asset metadata.
 *
 * <p>Example: {@code new BlockEntityAttrs("file.pdf", "application/pdf", path, url, path)}.</p>
 */
public record BlockEntityAttrs(
    String displayName,
    String contentType,
    String relativePath,
    String url,
    String localPath
) {
}
