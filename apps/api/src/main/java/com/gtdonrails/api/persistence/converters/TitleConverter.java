package com.gtdonrails.api.persistence.converters;

import com.gtdonrails.api.types.Title;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class TitleConverter implements AttributeConverter<Title, String> {

    /**
     * Stores title value objects as their raw text.
     *
     * <p>Example: {@code titleConverter.convertToDatabaseColumn(title)}.</p>
     */
    @Override
    public String convertToDatabaseColumn(Title attribute) {
        return attribute == null ? null : attribute.value();
    }

    /**
     * Rehydrates title value objects from stored raw text.
     *
     * <p>Example: {@code titleConverter.convertToEntityAttribute("Capture idea")}.</p>
     */
    @Override
    public Title convertToEntityAttribute(String dbData) {
        return dbData == null ? null : new Title(dbData);
    }
}
