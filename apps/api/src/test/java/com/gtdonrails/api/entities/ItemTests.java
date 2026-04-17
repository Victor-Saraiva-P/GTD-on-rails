package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.gtdonrails.api.enums.ItemStatus;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ItemTests {

    // title
    @Test
    void setTitleUpdatesTitle() {
        Item item = new Item("Capture idea", null);

        item.setTitle("Clarified title");

        assertEquals("Clarified title", item.getTitle());
    }

    @Test
    void setTitleRejectsNull() {
        Item item = new Item("Capture idea", null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTitle(null));

        assertEquals("title is required", exception.getMessage());
    }

    @Test
    void setTitleRejectsBlank() {
        Item item = new Item("Capture idea", null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTitle("   "));

        assertEquals("title is required", exception.getMessage());
    }

    @Test
    void setTitleAcceptsTitleAtMaxLength() {
        Item item = new Item("Capture idea", null);
        String titleAtMaxLength = "a".repeat(200);

        item.setTitle(titleAtMaxLength);

        assertEquals(titleAtMaxLength, item.getTitle());
    }

    @Test
    void setTitleRejectsTitleLongerThanMaxLength() {
        Item item = new Item("Capture idea", null);
        String titleLongerThanMaxLength = "a".repeat(201);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTitle(titleLongerThanMaxLength));

        assertEquals("title exceeds max length of 200", exception.getMessage());
    }

    // body
    @Test
    void setBodyUpdatesBody() {
        Item item = new Item("Capture idea", null);

        item.setBody("Expanded details");

        assertEquals("Expanded details", item.getBody());
    }

    @Test
    void setBodyAcceptsNull() {
        Item item = new Item("Capture idea", "Existing details");

        item.setBody(null);

        assertNull(item.getBody());
    }

    @Test
    void setBodyConvertsBlankToNull() {
        Item item = new Item("Capture idea", "Existing details");

        item.setBody("   ");

        assertNull(item.getBody());
    }

    @Test
    void setBodyAcceptsBodyAtMaxLength() {
        Item item = new Item("Capture idea", null);
        String bodyAtMaxLength = "a".repeat(10_000);

        item.setBody(bodyAtMaxLength);

        assertEquals(bodyAtMaxLength, item.getBody());
    }

    @Test
    void setBodyRejectsBodyLongerThanMaxLength() {
        Item item = new Item("Capture idea", null);
        String bodyLongerThanMaxLength = "a".repeat(10_001);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setBody(bodyLongerThanMaxLength));

        assertEquals("body exceeds max length of 10000", exception.getMessage());
    }

    // deletion
    @Test
    void softDeleteSetsDeletedAt() {
        Item item = new Item("Capture idea", null);

        assertNull(item.getDeletedAt());

        item.softDelete();

        assertNotNull(item.getDeletedAt());
    }

    @Test
    void reportsWhetherItemIsDeleted() {
        Item item = new Item("Capture idea", null);

        assertFalse(item.isDeleted());

        item.softDelete();

        assertTrue(item.isDeleted());
    }

    // status
    @Test
    void setsStatusToStuffWhenItemIsPersisted() {
        Item item = new Item("Capture idea", null);

        item.prePersist();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }
}
