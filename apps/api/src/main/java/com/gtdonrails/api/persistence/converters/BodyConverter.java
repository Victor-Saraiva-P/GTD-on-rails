package com.gtdonrails.api.persistence.converters;

import com.gtdonrails.api.json.JacksonJsonCodec;
import com.gtdonrails.api.json.JsonCodec;
import com.gtdonrails.api.json.JsonCodecException;
import com.gtdonrails.api.types.Body;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class BodyConverter implements AttributeConverter<Body, String> {

    private final JsonCodec jsonCodec;

    public BodyConverter() {
        this(new JacksonJsonCodec());
    }

    BodyConverter(JsonCodec jsonCodec) {
        this.jsonCodec = jsonCodec;
    }

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
            return jsonCodec.write(attribute);
        } catch (JsonCodecException exception) {
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
            return jsonCodec.read(dbData, Body.class);
        } catch (JsonCodecException exception) {
            throw new IllegalArgumentException(
                "body stored JSON '" + dbData + "' is invalid; expected Body JSON document",
                exception);
        }
    }
}
