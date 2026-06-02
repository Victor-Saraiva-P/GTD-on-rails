package com.gtdonrails.api.persistence.converters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.gtdonrails.api.config.GoogleProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class CryptoConverterTests {
    private static final String KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Test
    void encryptsAndDecryptsValues() {
        CryptoConverter converter = converterWithKey(KEY);

        String encryptedValue = converter.convertToDatabaseColumn("access-token");

        assertNotEquals("access-token", encryptedValue);
        assertTrue(encryptedValue.startsWith("gtdenc:v1:"));
        assertEquals("access-token", converter.convertToEntityAttribute(encryptedValue));
    }

    @Test
    void preservesNullEmptyAndLegacyPlaintextValues() {
        CryptoConverter converter = converterWithKey(KEY);

        assertNull(converter.convertToDatabaseColumn(null));
        assertEquals("", converter.convertToDatabaseColumn(""));
        assertEquals("legacy-token", converter.convertToEntityAttribute("legacy-token"));
    }

    @Test
    void rejectsMissingKeyWhenEncrypting() {
        CryptoConverter converter = converterWithKey("");

        assertThrows(IllegalStateException.class, () -> converter.convertToDatabaseColumn("token"));
    }

    @Test
    void rejectsKeyThatDoesNotDecodeToThirtyTwoBytes() {
        CryptoConverter converter = converterWithKey("c2hvcnQ=");

        assertThrows(IllegalStateException.class, () -> converter.convertToDatabaseColumn("token"));
    }

    private CryptoConverter converterWithKey(String tokenEncryptionKey) {
        GoogleProperties googleProperties = new GoogleProperties();
        googleProperties.setTokenEncryptionKey(tokenEncryptionKey);
        CryptoConverter converter = new CryptoConverter();
        converter.configure(googleProperties);
        return converter;
    }
}
