package com.gtdonrails.api.types;

/**
 * Optional block entity attributes mirrored from persisted asset metadata.
 *
 * <p>Example: {@code new BlockEntityAttrs("file.pdf", "application/pdf", url, path)}.</p>
 */
public record BlockEntityAttrs(
    String displayName,
    String contentType,
    String url,
    String localPath
) {
}
