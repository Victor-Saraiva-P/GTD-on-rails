package com.gtdonrails.api.json;

import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

public class JacksonJsonCodec implements JsonCodec {

    private final ObjectMapper objectMapper;

    public JacksonJsonCodec() {
        this(new ObjectMapper());
    }

    public JacksonJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Serializes a value through the configured Jackson mapper.
     *
     * <p>Example: {@code jacksonJsonCodec.write(body)}.</p>
     */
    @Override
    public String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new JsonCodecException("JSON serialization failed", exception);
        }
    }

    /**
     * Reads JSON text through the configured Jackson mapper.
     *
     * <p>Example: {@code jacksonJsonCodec.read(json, Body.class)}.</p>
     */
    @Override
    public <T> T read(String json, Class<T> targetType) {
        try {
            return objectMapper.readValue(json, targetType);
        } catch (JsonProcessingException exception) {
            throw new JsonCodecException("JSON parsing failed", exception);
        }
    }

    /**
     * Converts structured values through the configured Jackson mapper.
     *
     * <p>Example: {@code jacksonJsonCodec.convert(properties, ParagraphProperties.class)}.</p>
     */
    @Override
    public <T> T convert(Object value, Class<T> targetType) {
        try {
            return objectMapper.convertValue(value, targetType);
        } catch (IllegalArgumentException exception) {
            throw new JsonCodecException("JSON conversion failed", exception);
        }
    }

    /**
     * Converts project values into map-backed JSON objects through Jackson.
     *
     * <p>Example: {@code jacksonJsonCodec.toMap(paragraphProperties)}.</p>
     */
    @Override
    public Map<String, Object> toMap(Object value) {
        try {
            return objectMapper.convertValue(value, new TypeReference<>() {
            });
        } catch (IllegalArgumentException exception) {
            throw new JsonCodecException("JSON map conversion failed", exception);
        }
    }
}
