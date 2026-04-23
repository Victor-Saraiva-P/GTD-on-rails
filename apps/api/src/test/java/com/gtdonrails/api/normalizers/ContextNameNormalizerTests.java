package com.gtdonrails.api.normalizers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ContextNameNormalizerTests {

    private final ContextNameNormalizer contextNameNormalizer = new ContextNameNormalizer();

    @Test
    void normalizesContextNameWhitespace() {
        String normalizedName = contextNameNormalizer.normalize(" notebook\tcontext ");

        assertEquals("notebook context", normalizedName);
    }

    @Test
    void keepsNullNameAsNull() {
        String normalizedName = contextNameNormalizer.normalize(null);

        assertNull(normalizedName);
    }

    @Test
    void rejectsUnsupportedControlCharacters() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> contextNameNormalizer.normalize("street\u0001home"));

        assertEquals("context name contains unsupported control characters", exception.getMessage());
    }
}
