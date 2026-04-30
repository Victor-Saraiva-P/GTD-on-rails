package com.gtdonrails.api.types;

import java.util.List;
import java.util.Map;

import com.gtdonrails.api.json.JacksonJsonCodec;
import com.gtdonrails.api.json.JsonCodec;
import com.gtdonrails.api.json.JsonCodecException;

public record ParagraphProperties(List<RichTextRun> richText) {

    private static final JsonCodec JSON_CODEC = new JacksonJsonCodec();

    public ParagraphProperties {
        if (richText == null || richText.isEmpty()) {
            throw new IllegalArgumentException(
                "paragraph richText is required; expected at least one rich text run");
        }

        richText = List.copyOf(richText);
    }

    /**
     * Parses paragraph properties from flexible block maps.
     *
     * <p>Example: {@code ParagraphProperties.from(block.properties())}.</p>
     */
    public static ParagraphProperties from(Map<String, Object> properties) {
        try {
            return JSON_CODEC.convert(properties, ParagraphProperties.class);
        } catch (JsonCodecException exception) {
            throw validationException(properties, exception);
        }
    }

    /**
     * Converts paragraph properties back to flexible block JSON properties.
     *
     * <p>Example: {@code properties.toMap()}.</p>
     */
    public Map<String, Object> toMap() {
        return JSON_CODEC.toMap(this);
    }

    private static IllegalArgumentException validationException(Map<String, Object> properties, JsonCodecException exception) {
        if (exception.getCause() instanceof IllegalArgumentException cause) {
            return cause;
        }

        return new IllegalArgumentException(
            "paragraph properties '" + properties + "' are invalid; expected {richText:[...]}",
            exception);
    }
}
