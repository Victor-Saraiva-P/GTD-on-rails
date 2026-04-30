package com.gtdonrails.api.normalizers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ItemTextNormalizerTests {

    private final ItemTextNormalizer itemTextNormalizer = new ItemTextNormalizer();

    @Test
    void normalizesTitleWhitespaceAndLineBreaks() {
        String normalizedTitle = itemTextNormalizer.normalizeTitle(" Capture\tidea\r\nlater ");

        assertEquals("Capture idea later", normalizedTitle);
    }

    @Test
    void normalizesBodyLineEndingsAndBlankContent() {
        String normalizedBody = itemTextNormalizer.normalizeBody(" line 1\r\nline 2 ");
        String blankBody = itemTextNormalizer.normalizeBody("   ");

        assertEquals("line 1\nline 2", normalizedBody);
        assertNull(blankBody);
    }

    @Test
    void rejectsUnsupportedControlCharacters() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> itemTextNormalizer.normalizeTitle("bad\u0001title"));

        assertEquals("title character U+0001 is invalid; expected printable text", exception.getMessage());
    }
}
