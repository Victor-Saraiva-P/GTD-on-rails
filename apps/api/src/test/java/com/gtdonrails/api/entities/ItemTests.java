package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import java.time.LocalTime;

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
    void constructorWithoutCalendarSetsNullCalendar() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getCalendar());
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

        assertEquals("item subtype value is invalid; expected no subtype when marking as STUFF", exception.getMessage());
    }

    @Test
    void markAsStuffRejectsItemWithCalendar() {
        Item item = new Item(new Title("Capture idea"), null);
        new Calendar(item, LocalDate.parse("2026-05-21"), null);

        IllegalStateException exception = assertThrows(IllegalStateException.class, item::markAsStuff);

        assertEquals("item subtype value is invalid; expected no subtype when marking as STUFF", exception.getMessage());
    }

    @Test
    void convertToNextActionSetsStatusManually() {
        Item item = new Item(new Title("Capture idea"), null);
        item.convertToNextAction(java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        assertEquals(ItemStatus.NEXT_ACTION, item.getStatus());
    }

    @Test
    void convertToCalendarSetsStatusManually() {
        Item item = new Item(new Title("Capture idea"), null);

        Calendar calendar = item.convertToCalendar(LocalDate.parse("2026-05-21"), LocalTime.parse("14:15"));

        assertEquals(ItemStatus.CALENDAR, item.getStatus());
        assertEquals(calendar, item.getCalendar());
        assertEquals(LocalTime.parse("14:15"), calendar.getScheduledTime());
    }

    @Test
    void convertToCalendarRejectsDeletedStuff() {
        Item item = new Item(new Title("Capture idea"), null);
        item.softDelete();

        LocalDate date = LocalDate.parse("2026-05-21");
        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> item.convertToCalendar(date, null));

        assertEquals("item value 'STUFF' is invalid; expected active STUFF without subtype", exception.getMessage());
    }

    @Test
    void convertToCalendarRejectsNonStuff() {
        Item item = new Item(new Title("Capture idea"), null);
        item.convertToNextAction(java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        LocalDate date = LocalDate.parse("2026-05-21");
        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> item.convertToCalendar(date, null));

        assertEquals("item value 'NEXT_ACTION' is invalid; expected active STUFF without subtype", exception.getMessage());
    }

    @Test
    void prePersistDoesNotInferStatusFromNextAction() {
        Item item = new Item(new Title("Capture idea"), null);
        new NextAction(item, java.math.BigDecimal.ONE, java.time.Duration.ZERO, java.util.Set.of(new Context("home")));

        item.prePersist();

        assertEquals(ItemStatus.STUFF, item.getStatus());
    }
}
