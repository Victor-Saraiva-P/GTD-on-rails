package com.gtdonrails.api.persistence.converters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.types.Body;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class BodyConverter implements AttributeConverter<Body, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * Serializes item body value objects into database JSON.
     *
     * <p>Example: {@code bodyConverter.convertToDatabaseColumn(body)}.</p>
     */
    @Override
    public String convertToDatabaseColumn(Body attribute) {
        if (attribute == null) {
            return null;
        }

        try {
            return OBJECT_MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("body could not be serialized; expected JSON document", exception);
        }
    }

    /**
     * Rehydrates item body value objects from stored database JSON.
     *
     * <p>Example: {@code bodyConverter.convertToEntityAttribute(json)}.</p>
     */
    @Override
    public Body convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }

        try {
            return OBJECT_MAPPER.readValue(dbData, Body.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException(
                "body stored JSON '" + dbData + "' is invalid; expected Body JSON document",
                exception);
        }
    }
}
