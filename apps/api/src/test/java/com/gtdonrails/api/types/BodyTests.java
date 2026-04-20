package com.gtdonrails.api.types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class BodyTests {

    @Test
    void rejectsNullBody() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Body(null));

        assertEquals("body is required", exception.getMessage());
    }

    @Test
    void rejectsBlankBody() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Body("   "));

        assertEquals("body is required", exception.getMessage());
    }

    @Test
    void acceptsBodyAtMaxLength() {
        String bodyAtMaxLength = "a".repeat(Body.MAX_LENGTH);
        Body body = new Body(bodyAtMaxLength);

        assertEquals(bodyAtMaxLength, body.value());
    }

    @Test
    void rejectsBodyLongerThanMaxLength() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Body("a".repeat(Body.MAX_LENGTH + 1)));

        assertEquals("body exceeds max length of 10000", exception.getMessage());
    }
}
