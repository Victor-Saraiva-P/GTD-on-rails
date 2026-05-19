package com.gtdonrails.api.types;

/**
 * Connects an absolute text range to a persisted item asset.
 *
 * <p>Example: {@code new BlockEntity("b1", "pdf", 0, 12, assetId, null)}.</p>
 */
public record BlockEntity(
    String id,
    String type,
    int from,
    int to,
    String assetId,
    BlockEntityAttrs attrs
) {
}
