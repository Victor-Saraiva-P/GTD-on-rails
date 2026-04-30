package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.gtdonrails.api.types.Title;
import java.time.Instant;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ContextTests {

    // name
    @Test
    void setNameUpdatesName() {
        Context context = new Context("notebook");

        context.setName("college");

        assertEquals("college", context.getName());
    }

    @Test
    void setNameRejectsBlankName() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Context("   "));

        assertEquals("context name value '   ' is invalid; expected non-blank text", exception.getMessage());
    }

    @Test
    void setNameRejectsNameLongerThanMaxLength() {
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Context("a".repeat(Context.MAX_NAME_LENGTH + 1)));

        assertEquals(
            "context name length " + (Context.MAX_NAME_LENGTH + 1)
                + " is invalid; expected at most " + Context.MAX_NAME_LENGTH + " characters",
            exception.getMessage());
    }

    // items
    @Test
    void tracksItemsThroughItemRelation() {
        Context context = new Context("street");
        Item item = new Item(new Title("Buy cable"), null);

        item.addContext(context);

        assertTrue(context.getItems().contains(item));
    }

    // lifecycle
    @Test
    void prePersistInitializesAuditTimestamps() {
        Context context = new Context("street");

        context.prePersist();

        assertNotNull(context.getCreatedAt());
        assertNotNull(context.getUpdatedAt());
    }

    @Test
    void preUpdateRefreshesUpdatedAt() {
        Context context = new Context("street");
        context.prePersist();
        Instant previousUpdatedAt = context.getUpdatedAt();

        context.preUpdate();

        assertTrue(context.getUpdatedAt().isAfter(previousUpdatedAt));
    }
}
