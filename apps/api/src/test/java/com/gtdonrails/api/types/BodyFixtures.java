package com.gtdonrails.api.types;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BodyFixtures {

    private BodyFixtures() {
    }

    public static Body paragraphBody(String text) {
        return new Body(Body.CURRENT_VERSION, List.of(paragraphBlock(text, null, null)));
    }

    public static Body highlightedParagraphBody(String text) {
        return new Body(Body.CURRENT_VERSION, List.of(paragraphBlock(text, "red", "gray")));
    }

    public static Body linkedParagraphBody(String text, String link) {
        Map<String, Object> properties = properties(new ParagraphProperties(List.of(
            new RichTextRun(text, List.of(RichTextMark.BOLD), null, null, link))));
        return new Body(Body.CURRENT_VERSION, List.of(paragraphBlock(properties)));
    }

    private static BodyBlock paragraphBlock(String text, String textColor, String backgroundColor) {
        return paragraphBlock(paragraphProperties(text, textColor, backgroundColor));
    }

    private static BodyBlock paragraphBlock(Map<String, Object> properties) {
        return new BodyBlock(UUID.randomUUID(), BodyBlock.PARAGRAPH_TYPE, properties, null);
    }

    private static Map<String, Object> paragraphProperties(String text, String textColor, String backgroundColor) {
        return properties(new ParagraphProperties(List.of(
            new RichTextRun(
                text,
                List.of(),
                RichTextColor.from(textColor),
                RichTextColor.from(backgroundColor),
                null))));
    }

    private static Map<String, Object> properties(ParagraphProperties paragraphProperties) {
        return paragraphProperties.toMap();
    }
}
