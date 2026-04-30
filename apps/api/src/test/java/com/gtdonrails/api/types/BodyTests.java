package com.gtdonrails.api.types;

import static com.gtdonrails.api.types.BodyFixtures.highlightedParagraphBody;
import static com.gtdonrails.api.types.BodyFixtures.linkedParagraphBody;
import static com.gtdonrails.api.types.BodyFixtures.paragraphBody;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class BodyTests {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void acceptsParagraphBlockWithRichTextColors() {
        Body body = highlightedParagraphBody("Colored");

        assertEquals(Body.CURRENT_VERSION, body.version());
        assertEquals("paragraph", body.blocks().getFirst().type());
    }

    @Test
    void acceptsParagraphBlockWithRichTextLink() {
        Body body = linkedParagraphBody("Open docs", "https://example.com");

        assertEquals("paragraph", body.blocks().getFirst().type());
    }

    @Test
    void normalizesRichTextLineEndings() {
        BodyBlock bodyBlock = block("paragraph", paragraphProperties("Line 1\r\nLine 2\rLine 3"));

        assertEquals("Line 1\nLine 2\nLine 3", richTextRun(bodyBlock).get("text"));
    }

    @Test
    void normalizesRichTextMarksAndOptionalFields() {
        RichTextRun richTextRun = new RichTextRun(
            "Text",
            List.of(RichTextMark.ITALIC, RichTextMark.BOLD, RichTextMark.BOLD),
            RichTextColor.RED,
            null,
            " https://example.com ");

        assertEquals(List.of(RichTextMark.BOLD, RichTextMark.ITALIC), richTextRun.marks());
        assertEquals(RichTextColor.RED, richTextRun.textColor());
        assertNull(richTextRun.backgroundColor());
        assertEquals("https://example.com", richTextRun.link());
    }

    @Test
    void rejectsUnsupportedRichTextControlCharacters() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new RichTextRun("Text\u0007", List.of(), null, null, null));

        assertEquals(
            "rich text run text contains unsupported control character '7'; expected printable text, newline, or tab",
            exception.getMessage());
    }

    @Test
    void rejectsUnsupportedBodyVersion() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Body(2, List.of()));

        assertEquals("body version '2' is invalid; expected version 1", exception.getMessage());
    }

    @Test
    void rejectsEmptyBodyBlocks() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Body(Body.CURRENT_VERSION, List.of()));

        assertEquals("body blocks are required; expected at least one block", exception.getMessage());
    }

    @Test
    void rejectsUnknownBlockType() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> block("toggle", paragraphProperties("Nested")));

        assertEquals("body block type 'toggle' is invalid; expected 'paragraph'", exception.getMessage());
    }

    @Test
    void rejectsParagraphChildren() {
        BodyBlock childBlock = paragraphBody("Child").blocks().getFirst();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new BodyBlock(UUID.randomUUID(), "paragraph", paragraphProperties("Parent"), List.of(childBlock)));

        assertEquals("paragraph content is invalid; expected absent or empty content", exception.getMessage());
    }

    @Test
    void rejectsInvalidRichTextMark() {
        Map<String, Object> properties = OBJECT_MAPPER.convertValue(OBJECT_MAPPER.createObjectNode()
            .set("richText", OBJECT_MAPPER.createArrayNode()
                .add(OBJECT_MAPPER.createObjectNode()
                    .put("text", "Text")
                    .set("marks", OBJECT_MAPPER.createArrayNode().add("sparkle")))),
            new TypeReference<>() {
            });

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> block("paragraph", properties));

        assertTrue(exception.getMessage().contains("rich text mark 'sparkle' is invalid"));
    }

    @Test
    void rejectsInvalidTextColor() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> RichTextColor.from("teal"));

        assertTrue(exception.getMessage().contains("rich text color 'teal' is invalid"));
    }

    @Test
    void rejectsInvalidLink() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new RichTextRun("Text", List.of(), null, null, "mailto:test@example.com"));

        assertEquals("rich text link 'mailto:test@example.com' is invalid; expected http(s) URL", exception.getMessage());
    }

    private static BodyBlock block(String type, Map<String, Object> properties) {
        return new BodyBlock(UUID.randomUUID(), type, properties, null);
    }

    private static Map<String, Object> paragraphProperties(String text) {
        return properties(new RichTextRun(text, List.of(), null, null, null));
    }

    private static Map<String, Object> properties(RichTextRun richTextRun) {
        return OBJECT_MAPPER.convertValue(new ParagraphProperties(List.of(richTextRun)), new TypeReference<>() {
        });
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> richTextRun(BodyBlock bodyBlock) {
        List<Map<String, Object>> richText = (List<Map<String, Object>>) bodyBlock.properties().get("richText");
        return richText.getFirst();
    }
}
