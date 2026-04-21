package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    // contexts
    @Test
    void addContextAddsContextToItem() {
        Item item = new Item(new Title("Capture idea"), null);
        Context context = new Context("notebook");

        item.addContext(context);

        assertTrue(item.getContexts().contains(context));
    }

    @Test
    void addContextRejectsNull() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.addContext(null));

        assertEquals("context is required", exception.getMessage());
    }

    @Test
    void removeContextRemovesContextFromItem() {
        Item item = new Item(new Title("Capture idea"), null);
        Context context = new Context("college");
        item.addContext(context);

        item.removeContext(context);

        assertFalse(item.getContexts().contains(context));
    }

    // status
    @Test
    void setsStatusToStuffWhenItemIsPersisted() {
        Item item = new Item(new Title("Capture idea"), null);

        item.prePersist();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }

    @Test
    void keepsStatusAsStuffWhenItemIsUpdated() {
        Item item = new Item(new Title("Capture idea"), null);
        item.prePersist();

        item.preUpdate();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }
}
