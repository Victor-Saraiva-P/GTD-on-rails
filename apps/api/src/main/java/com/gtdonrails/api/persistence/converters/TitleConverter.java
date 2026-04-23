package com.gtdonrails.api.persistence.converters;

import com.gtdonrails.api.types.Title;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class TitleConverter implements AttributeConverter<Title, String> {

    @Override
    public String convertToDatabaseColumn(Title attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public Title convertToEntityAttribute(String dbData) {
        return dbData == null ? null : new Title(dbData);
    }
}
