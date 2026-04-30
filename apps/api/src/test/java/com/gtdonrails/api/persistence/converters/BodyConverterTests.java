package com.gtdonrails.api.persistence.converters;

import static com.gtdonrails.api.types.BodyFixtures.highlightedParagraphBody;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.gtdonrails.api.types.Body;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class BodyConverterTests {

    private final BodyConverter converter = new BodyConverter();

    @Test
    void convertsBodyToJsonAndBack() {
        Body body = highlightedParagraphBody("Styled text");

        String serializedBody = converter.convertToDatabaseColumn(body);
        Body deserializedBody = converter.convertToEntityAttribute(serializedBody);

        assertEquals(body, deserializedBody);
    }

    @Test
    void returnsNullWhenDatabaseBodyIsNull() {
        assertNull(converter.convertToEntityAttribute(null));
    }

    @Test
    void rejectsMalformedDatabaseBody() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> converter.convertToEntityAttribute("{not-json"));

        assertEquals("body stored JSON '{not-json' is invalid; expected Body JSON document", exception.getMessage());
    }
}
