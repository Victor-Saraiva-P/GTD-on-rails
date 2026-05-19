package com.gtdonrails.api.types;

/**
 * Marks an absolute text range with inline presentation metadata.
 *
 * <p>Example: {@code new InlineMark("m1", "bold", 0, 4, null)}.</p>
 */
public record InlineMark(
    String id,
    String type,
    int from,
    int to,
    InlineMarkAttrs attrs
) {
}
