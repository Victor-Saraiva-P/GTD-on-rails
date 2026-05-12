package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;

import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class NextActionTests {

    @Test
    void constructorAssociatesItemAndRequiredMetadata() {
        Item item = new Item(new Title("Capture idea"), null);
        Context context = new Context("home");

        NextAction nextAction = new NextAction(item, new BigDecimal("4.5"), Duration.ofMinutes(30), Set.of(context));

        assertEquals(nextAction, item.getNextAction());
        assertEquals(item, nextAction.getItem());
        assertEquals(new BigDecimal("4.5"), nextAction.getEnergy());
        assertEquals(Duration.ofMinutes(30), nextAction.getEstimatedTime());
        assertTrue(nextAction.getContexts().contains(context));
        assertTrue(context.getNextActions().contains(nextAction));
    }

    @Test
    void setEnergyRejectsNull() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEnergy(null));

        assertEquals("energy value 'null' is invalid; expected BigDecimal", exception.getMessage());
    }

    @Test
    void setEnergyRejectsMoreThanOneDecimalPlace() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEnergy(new BigDecimal("4.25")));

        assertEquals("energy value '4.25' is invalid; expected up to 1 decimal place", exception.getMessage());
    }

    @Test
    void setEnergyAcceptsWholeNumbersAndNormalizesScale() {
        NextAction nextAction = nextAction();

        nextAction.setEnergy(new BigDecimal("7"));

        assertEquals(new BigDecimal("7.0"), nextAction.getEnergy());
    }

    @Test
    void setEnergyRejectsValuesOutsideRange() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEnergy(new BigDecimal("10.1")));

        assertEquals("energy value '10.1' is invalid; expected between 0.0 and 10.0", exception.getMessage());
    }

    @Test
    void setEstimatedTimeRejectsNull() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEstimatedTime(null));

        assertEquals("time value 'null' is invalid; expected Duration", exception.getMessage());
    }

    @Test
    void setEstimatedTimeRejectsNegativeDuration() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEstimatedTime(Duration.ofMinutes(-1)));

        assertEquals("time value 'PT-1M' is invalid; expected greater than or equal to PT0M", exception.getMessage());
    }

    @Test
    void setEstimatedTimeRejectsSecondsPrecision() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.setEstimatedTime(Duration.ofSeconds(30)));

        assertEquals("time value 'PT30S' is invalid; expected whole-minute Duration", exception.getMessage());
    }

    @Test
    void constructorCreatesUnscheduledSchedule() {
        NextAction nextAction = nextAction();

        assertNotNull(nextAction.getSchedule());
        assertFalse(nextAction.getSchedule().isAllDay());
    }

    @Test
    void registerScheduleStartDelegatesToScheduleWindow() {
        NextAction nextAction = nextAction();

        nextAction.registerScheduleStart(clockAt("2026-05-10T10:00:00Z"));

        assertEquals("2026-05-10", nextAction.getSchedule().getDateStart().toString());
        assertEquals("10:00", nextAction.getSchedule().getTimeStart().toString());
    }

    @Test
    void registerScheduleEndDelegatesToScheduleWindow() {
        NextAction nextAction = nextAction();
        nextAction.registerScheduleStart(clockAt("2026-05-10T10:00:00Z"));

        nextAction.registerScheduleEnd(clockAt("2026-05-10T11:00:00Z"));

        assertEquals("2026-05-10", nextAction.getSchedule().getDateEnd().toString());
        assertEquals("11:00", nextAction.getSchedule().getTimeEnd().toString());
    }

    @Test
    void removeContextKeepsBothSidesAligned() {
        NextAction nextAction = nextAction();
        Context context = nextAction.getContexts().iterator().next();

        nextAction.removeContext(context);

        assertFalse(nextAction.getContexts().contains(context));
        assertFalse(context.getNextActions().contains(nextAction));
    }

    @Test
    void replaceContextsRejectsEmptyContexts() {
        NextAction nextAction = nextAction();

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> nextAction.replaceContexts(Set.of()));

        assertEquals("contexts value '[]' is invalid; expected at least one Context", exception.getMessage());
    }

    private NextAction nextAction() {
        Item item = new Item(new Title("Capture idea"), null);
        return new NextAction(item, new BigDecimal("3.0"), Duration.ofMinutes(15), Set.of(new Context("home")));
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }
}
