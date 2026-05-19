package com.gtdonrails.api.types;

/**
 * Optional inline mark attributes owned by the item body model.
 *
 * <p>Example: {@code new InlineMarkAttrs("https://example.com", null)}.</p>
 */
public record InlineMarkAttrs(String href, String color) {
}
