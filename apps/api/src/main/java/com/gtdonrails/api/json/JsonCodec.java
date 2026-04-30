package com.gtdonrails.api.json;

import java.util.Map;

public interface JsonCodec {

    /**
     * Serializes a value into JSON text.
     *
     * <p>Example: {@code jsonCodec.write(body)}.</p>
     */
    String write(Object value);

    /**
     * Deserializes JSON text into the requested project type.
     *
     * <p>Example: {@code jsonCodec.read(json, Body.class)}.</p>
     */
    <T> T read(String json, Class<T> targetType);

    /**
     * Converts structured data into the requested project type.
     *
     * <p>Example: {@code jsonCodec.convert(properties, ParagraphProperties.class)}.</p>
     */
    <T> T convert(Object value, Class<T> targetType);

    /**
     * Converts a project value into a map-backed JSON object.
     *
     * <p>Example: {@code jsonCodec.toMap(paragraphProperties)}.</p>
     */
    Map<String, Object> toMap(Object value);
}
