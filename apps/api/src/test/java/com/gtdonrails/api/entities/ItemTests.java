package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.time.Instant;

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

    // body
    @Test
    void setBodyAllowsNull() {
        Item item = new Item(new Title("Capture idea"), new Body("Details"));

        item.setBody(null);

        assertNull(item.getBody());
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

    // timestamps
    @Test
    void setsCreatedAtWhenItemIsPersisted() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getCreatedAt());

        item.prePersist();

        assertNotNull(item.getCreatedAt());
    }

    @Test
    void keepsExistingCreatedAtWhenItemIsPersisted() throws Exception {
        Item item = new Item(new Title("Capture idea"), null);
        Instant existingCreatedAt = Instant.parse("2026-01-01T10:15:30Z");
        Field createdAtField = Item.class.getDeclaredField("createdAt");
        createdAtField.setAccessible(true);
        createdAtField.set(item, existingCreatedAt);

        item.prePersist();

        assertEquals(existingCreatedAt, item.getCreatedAt());
    }
}
