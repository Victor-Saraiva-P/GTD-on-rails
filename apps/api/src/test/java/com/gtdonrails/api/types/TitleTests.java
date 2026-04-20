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

        assertEquals("title is required", exception.getMessage());
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

        assertEquals("title exceeds max length of 200", exception.getMessage());
    }
}
