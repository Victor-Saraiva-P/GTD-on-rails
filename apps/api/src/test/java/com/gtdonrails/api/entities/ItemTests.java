package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static com.gtdonrails.api.types.BodyFixtures.paragraphBody;

import java.math.BigDecimal;
import java.time.Duration;

import com.gtdonrails.api.enums.ItemStatus;
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
        Item item = new Item(new Title("Capture idea"), paragraphBody("Details"));

        item.setBody(null);

        assertNull(item.getBody());
    }

    // energy
    @Test
    void constructorWithoutEnergySetsNullEnergy() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getEnergy());
    }

    @Test
    void setEnergyUpdatesEnergy() {
        Item item = new Item(new Title("Capture idea"), null);

        item.setEnergy(new BigDecimal("4.5"));

        assertEquals(new BigDecimal("4.5"), item.getEnergy());
    }

    @Test
    void setEnergyDefaultsToZeroWhenNull() {
        Item item = new Item(new Title("Capture idea"), null, new BigDecimal("3.0"));

        item.setEnergy(null);

        assertNull(item.getEnergy());
    }

    @Test
    void setEnergyRejectsMoreThanOneDecimalPlace() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setEnergy(new BigDecimal("4.25")));

        assertEquals("energy must have up to 1 decimal place", exception.getMessage());
    }

    @Test
    void setEnergyAcceptsWholeNumbersAndNormalizesScale() {
        Item item = new Item(new Title("Capture idea"), null);

        item.setEnergy(new BigDecimal("7"));

        assertEquals(new BigDecimal("7.0"), item.getEnergy());
    }

    @Test
    void setEnergyRejectsValuesBelowRange() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setEnergy(new BigDecimal("-0.1")));

        assertEquals("energy must be between 0.0 and 10.0", exception.getMessage());
    }

    @Test
    void setEnergyRejectsValuesAboveRange() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setEnergy(new BigDecimal("10.1")));

        assertEquals("energy must be between 0.0 and 10.0", exception.getMessage());
    }

    // time
    @Test
    void constructorWithoutTimeSetsNullTime() {
        Item item = new Item(new Title("Capture idea"), null);

        assertNull(item.getTime());
    }

    @Test
    void setTimeUpdatesTime() {
        Item item = new Item(new Title("Capture idea"), null);

        item.setTime(Duration.ofHours(1).plusMinutes(30));

        assertEquals(Duration.ofMinutes(90), item.getTime());
    }

    @Test
    void setTimeAllowsNull() {
        Item item = new Item(new Title("Capture idea"), null, new BigDecimal("3.0"), Duration.ofMinutes(45));

        item.setTime(null);

        assertNull(item.getTime());
    }

    @Test
    void setTimeRejectsNegativeDuration() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTime(Duration.ofMinutes(-1)));

        assertEquals("time must be greater than or equal to PT0M", exception.getMessage());
    }

    @Test
    void setTimeRejectsSecondsPrecision() {
        Item item = new Item(new Title("Capture idea"), null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> item.setTime(Duration.ofSeconds(30)));

        assertEquals("time must be expressed in hours and minutes only", exception.getMessage());
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
