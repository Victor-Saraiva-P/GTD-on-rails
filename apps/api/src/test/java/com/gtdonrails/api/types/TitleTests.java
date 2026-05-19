package com.gtdonrails.api.types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class TitleTests {

    @Test
    void rejectsBlankTitle() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Title("   "));

        assertEquals("title value '   ' is invalid; expected non-blank text", exception.getMessage());
    }

    @Test
    void acceptsTitleAtMaxLength() {
        String titleAtMaxLength = "a".repeat(Title.MAX_LENGTH);
        Title title = new Title(titleAtMaxLength);

        assertEquals(titleAtMaxLength, title.value());
    }

    @Test
    void rejectsTitleLongerThanMaxLength() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Title("a".repeat(Title.MAX_LENGTH + 1)));

        assertEquals("title value length 201 is invalid; expected at most 200 characters", exception.getMessage());
    }
}
