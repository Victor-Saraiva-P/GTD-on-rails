package com.gtdonrails.api.types;

import java.util.List;

/**
 * Stores editable item text plus structured metadata ranges.
 *
 * <p>Example: {@code ItemBody.empty()}.</p>
 */
public record ItemBody(
    String text,
    List<InlineMark> inlineMarks,
    List<LineBlock> lineBlocks,
    List<BlockEntity> blockEntities
) {

    public static ItemBody empty() {
        return new ItemBody("", List.of(), List.of(), List.of());
    }
}
