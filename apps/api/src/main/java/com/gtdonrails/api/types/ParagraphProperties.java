package com.gtdonrails.api.types;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public record ParagraphProperties(List<RichTextRun> richText) {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public ParagraphProperties {
        if (richText == null || richText.isEmpty()) {
            throw new IllegalArgumentException(
                "paragraph richText is required; expected at least one rich text run");
        }

        richText = List.copyOf(richText);
    }

    /**
     * Parses paragraph properties from flexible block JSON.
     *
     * <p>Example: {@code ParagraphProperties.from(block.properties())}.</p>
     */
    public static ParagraphProperties from(JsonNode properties) {
        return fromJsonNode(properties);
    }

    /**
     * Parses paragraph properties from flexible block maps.
     *
     * <p>Example: {@code ParagraphProperties.from(block.properties())}.</p>
     */
    public static ParagraphProperties from(Map<String, Object> properties) {
        return fromJsonNode(OBJECT_MAPPER.valueToTree(properties));
    }

    /**
     * Converts paragraph properties back to flexible block JSON properties.
     *
     * <p>Example: {@code properties.toMap()}.</p>
     */
    public Map<String, Object> toMap() {
        return OBJECT_MAPPER.convertValue(this, new TypeReference<>() {
        });
    }

    private static ParagraphProperties fromJsonNode(JsonNode properties) {
        try {
            return OBJECT_MAPPER.treeToValue(properties, ParagraphProperties.class);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (JsonMappingException exception) {
            throw validationException(properties, exception);
        } catch (Exception exception) {
            throw new IllegalArgumentException(
                "paragraph properties '" + properties + "' are invalid; expected {richText:[...]}",
                exception);
        }
    }

    private static IllegalArgumentException validationException(JsonNode properties, JsonMappingException exception) {
        if (exception.getCause() instanceof IllegalArgumentException cause) {
            return cause;
        }

        return new IllegalArgumentException(
            "paragraph properties '" + properties + "' are invalid; expected {richText:[...]}",
            exception);
    }
}
