package com.gtdonrails.api.persistence.converters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.types.ItemBody;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ItemBodyConverter implements AttributeConverter<ItemBody, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(ItemBody attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(ItemBodyNormalizer.normalizeBodyValue(attribute));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("item body value is invalid; expected JSON-serializable body", exception);
        }
    }

    @Override
    public ItemBody convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return ItemBody.empty();
        }

        try {
            return ItemBodyNormalizer.normalizeBodyValue(OBJECT_MAPPER.readValue(dbData, ItemBody.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("item body JSON value is invalid; expected ItemBody object", exception);
        }
    }
}
