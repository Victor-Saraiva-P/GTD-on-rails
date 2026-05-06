package com.gtdonrails.api.normalizers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.BlockEntityAttrs;
import com.gtdonrails.api.types.InlineMark;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.LineBlock;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ItemBodyNormalizerTests {

    private final ItemBodyNormalizer itemBodyNormalizer = new ItemBodyNormalizer();

    @Test
    void normalizesNullBodyAndNullFields() {
        ItemBody normalized = itemBodyNormalizer.normalizeBody(new ItemBody(null, null, null, null));

        assertEquals("", normalized.text());
        assertTrue(normalized.inlineMarks().isEmpty());
        assertTrue(normalized.lineBlocks().isEmpty());
        assertTrue(normalized.blockEntities().isEmpty());
    }

    @Test
    void normalizesTextLineEndings() {
        ItemBody normalized = itemBodyNormalizer.normalizeBody(new ItemBody("a\r\nb\rc", null, null, null));

        assertEquals("a\nb\nc", normalized.text());
    }

    @Test
    void clampsRangesAndRemovesInvalidRangesAndTypes() {
        ItemBody body = new ItemBody(
            "abcd",
            List.of(new InlineMark("m1", "bold", -2, 9, null), new InlineMark("m2", "bad", 0, 1, null), new InlineMark("m3", "italic", 2, 2, null)),
            List.of(new LineBlock("l1", "heading1", -1, 8, null), new LineBlock("l2", "bad", 0, 1, null)),
            List.of(new BlockEntity("b1", "pdf", -5, 40, "asset-id", null), new BlockEntity("b2", "bad", 0, 1, "asset-id", null)));

        ItemBody normalized = itemBodyNormalizer.normalizeBody(body);

        assertEquals(new InlineMark("m1", "bold", 0, 4, null), normalized.inlineMarks().getFirst());
        assertEquals(new LineBlock("l1", "heading1", 0, 4, null), normalized.lineBlocks().getFirst());
        assertEquals(new BlockEntity("b1", "pdf", 0, 4, "asset-id", null), normalized.blockEntities().getFirst());
        assertEquals(1, normalized.inlineMarks().size());
        assertEquals(1, normalized.lineBlocks().size());
        assertEquals(1, normalized.blockEntities().size());
    }

    @Test
    void preservesAssetTokensAndBlockEntityAttrs() {
        BlockEntityAttrs attrs = new BlockEntityAttrs("file.pdf", "application/pdf", "items/id/file.pdf", "/assets/file.pdf", "items/id/file.pdf");
        ItemBody body = new ItemBody("see ⟦asset:asset_id⟧", List.of(), List.of(), List.of(new BlockEntity("b1", "pdf", 4, 22, "asset_id", attrs)));

        ItemBody normalized = itemBodyNormalizer.normalizeBody(body);

        assertEquals("see ⟦asset:asset_id⟧", normalized.text());
        assertEquals(attrs, normalized.blockEntities().getFirst().attrs());
    }
}
