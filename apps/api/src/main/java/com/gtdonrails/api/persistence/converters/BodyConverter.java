package com.gtdonrails.api.persistence.converters;

import com.gtdonrails.api.types.Body;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class BodyConverter implements AttributeConverter<Body, String> {

    @Override
    public String convertToDatabaseColumn(Body attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public Body convertToEntityAttribute(String dbData) {
        return dbData == null ? null : new Body(dbData);
    }
}
