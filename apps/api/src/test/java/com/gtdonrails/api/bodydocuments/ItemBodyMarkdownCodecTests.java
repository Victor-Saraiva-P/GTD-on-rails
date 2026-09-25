package com.gtdonrails.api.bodydocuments;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.BlockEntityAttrs;
import com.gtdonrails.api.types.InlineMark;
import com.gtdonrails.api.types.InlineMarkAttrs;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.LineBlock;
import com.gtdonrails.api.types.LineBlockAttrs;
import org.junit.jupiter.api.Test;

class ItemBodyMarkdownCodecTests {

    private final ItemBodyMarkdownCodec codec = new ItemBodyMarkdownCodec();

    @Test
    void materializesLegacyInlineAndBlockFormattingAsMarkdown() {
        ItemBody body = new ItemBody(
            "Important\nRead docs",
            List.of(new InlineMark("bold-1", "bold", 0, 9, null)),
            List.of(new LineBlock("quote-1", "quote", 10, 19, null)),
            List.of()
        );

        assertEquals("**Important**\n> Read docs", codec.toMarkdown(body));
    }

    @Test
    void materializesCheckedChecklistAsMarkdown() {
        ItemBody body = new ItemBody(
            "Done",
            List.of(),
            List.of(new LineBlock("check-1", "checklist", 0, 4, new LineBlockAttrs(true))),
            List.of()
        );

        assertEquals("- [x] Done", codec.toMarkdown(body));
    }

    @Test
    void materializesLegacyLinkMarkAsMarkdown() {
        ItemBody body = new ItemBody(
            "OpenAI",
            List.of(new InlineMark("link-1", "link", 0, 6, new InlineMarkAttrs("https://openai.com", null))),
            List.of(),
            List.of()
        );

        assertEquals("[OpenAI](https://openai.com)", codec.toMarkdown(body));
    }

    @Test
    void replacesAssetTokenWithRelativeMarkdownImage() {
        UUID assetId = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        String token = "⟦asset:" + assetId + "⟧";
        ItemBody body = new ItemBody(
            "See " + token,
            List.of(),
            List.of(),
            List.of(new BlockEntity(
                "entity-1",
                "image",
                4,
                4 + token.length(),
                assetId.toString(),
                new BlockEntityAttrs(
                    "diagram.png",
                    "image/png",
                    "items/item/" + assetId + "/diagram.png",
                    "/assets/items/item/" + assetId + "/diagram.png",
                    null
                )
            ))
        );

        assertEquals(
            "See ![diagram.png](assets/" + assetId + "/diagram.png)",
            codec.toMarkdown(body)
        );
    }
}
