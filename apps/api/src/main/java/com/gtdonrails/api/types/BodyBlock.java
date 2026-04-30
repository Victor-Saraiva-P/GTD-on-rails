package com.gtdonrails.api.types;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record BodyBlock(
    UUID id,
    String type,
    Map<String, Object> properties,
    List<BodyBlock> content
) {

    public static final String PARAGRAPH_TYPE = "paragraph";

    public BodyBlock {
        requireId(id);
        requireParagraphType(type);
        requireProperties(properties);
        content = normalizeContent(content);
        requireParagraphHasNoChildren(type, content);
        properties = ParagraphProperties.from(properties).toMap();
    }

    private static void requireId(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("body block id is required; expected UUID");
        }
    }

    private static void requireParagraphType(String type) {
        if (!PARAGRAPH_TYPE.equals(type)) {
            throw new IllegalArgumentException(
                "body block type '" + type + "' is invalid; expected 'paragraph'");
        }
    }

    private static void requireProperties(Map<String, Object> properties) {
        if (properties == null || properties.isEmpty()) {
            throw new IllegalArgumentException(
                "paragraph properties '" + properties + "' are invalid; expected object");
        }
    }

    private static List<BodyBlock> normalizeContent(List<BodyBlock> content) {
        if (content == null) {
            return List.of();
        }

        return List.copyOf(content);
    }

    private static void requireParagraphHasNoChildren(String type, List<BodyBlock> content) {
        if (PARAGRAPH_TYPE.equals(type) && !content.isEmpty()) {
            throw new IllegalArgumentException("paragraph content is invalid; expected absent or empty content");
        }
    }
}
