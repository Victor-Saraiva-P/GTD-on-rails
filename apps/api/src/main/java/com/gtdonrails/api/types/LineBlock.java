package com.gtdonrails.api.types;

/**
 * Applies whole-line behavior to an absolute text range.
 *
 * <p>Example: {@code new LineBlock("l1", "heading1", 0, 8, null)}.</p>
 */
public record LineBlock(
    String id,
    String type,
    int from,
    int to,
    LineBlockAttrs attrs
) {
}
