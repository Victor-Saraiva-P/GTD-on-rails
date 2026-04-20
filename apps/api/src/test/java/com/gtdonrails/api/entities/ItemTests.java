package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ItemTests {

    // title
    @Test
    void setTitleUpdatesTitle() {
        Item item = new Item(new Title("Capture idea"), null);

        item.setTitle(new Title("Clarified title"));

        assertEquals("Clarified title", item.getTitle().value());
    }

    @Test
    void setTitleRejectsNull() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTitle(null));

        assertEquals("title is required", exception.getMessage());
    }

    // deletion
    @Test
    void softDeleteSetsDeletedAt() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getDeletedAt());

        item.softDelete();

        assertNotNull(item.getDeletedAt());
    }

    @Test
    void reportsWhetherItemIsDeleted() {
        Item item = new Item(new Title("Capture idea"), null);

        assertFalse(item.isDeleted());

        item.softDelete();

        assertTrue(item.isDeleted());
    }

    // status
    @Test
    void setsStatusToStuffWhenItemIsPersisted() {
        Item item = new Item(new Title("Capture idea"), null);

        item.prePersist();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }
}
