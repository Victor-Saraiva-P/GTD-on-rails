package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ItemTests {

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

        assertEquals("item title value 'null' is invalid; expected Title", exception.getMessage());
    }

    @Test
    void setBodyNormalizesNullToEmptyText() {
        Item item = new Item(new Title("Capture idea"), "Details");

        item.setBody(null);

        assertEquals("", item.getBody().text());
    }

    @Test
    void setBodyNormalizesMarkdownText() {
        Item item = new Item(new Title("Capture idea"), "Details");

        item.setBody(new ItemBody(" line 1\r\nline 2 ", null, null, null));

        assertEquals(" line 1\nline 2 ", item.getBody().text());
    }

    @Test
    void constructorWithoutNextActionSetsNullNextAction() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getNextAction());
    }

    @Test
    void constructorSetsStatusToStuff() {
        Item item = new Item(new Title("Capture idea"), null);

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }

    @Test
    void markAsStuffExplicitlySetsStatusToStuff() {
        Item item = new Item(new Title("Capture idea"), null);

        item.markAsStuff();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }

    @Test
    void markAsStuffRejectsItemWithNextAction() {
        Item item = new Item(new Title("Capture idea"), null);
        new NextAction(item, java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        IllegalStateException exception = assertThrows(IllegalStateException.class, item::markAsStuff);

        assertEquals("item nextAction value is invalid; expected no next action when marking as STUFF", exception.getMessage());
    }

    @Test
    void convertToNextActionSetsStatusManually() {
        Item item = new Item(new Title("Capture idea"), null);
        item.convertToNextAction(java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        assertEquals(ItemStatus.NEXT_ACTION, item.getStatus());
    }

    @Test
    void prePersistDoesNotInferStatusFromNextAction() {
        Item item = new Item(new Title("Capture idea"), null);
        new NextAction(item, java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        item.prePersist();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }
}
