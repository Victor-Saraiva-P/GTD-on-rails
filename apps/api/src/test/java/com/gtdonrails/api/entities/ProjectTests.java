package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.gtdonrails.api.enums.ProjectStatus;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class ProjectTests {

    @Test
    void constructorCreatesActiveProject() {
        Project project = project();

        assertEquals(ProjectStatus.ACTIVE, project.getStatus());
        assertNull(project.getDoneDate());
        assertNull(project.getDoneTime());
    }

    @Test
    void markDoneCapturesCompletionDateAndTime() {
        Project project = project();

        project.markDone(clockAt("2026-05-21T12:34:56Z"));

        assertEquals(ProjectStatus.DONE, project.getStatus());
        assertEquals("2026-05-21", project.getDoneDate().toString());
        assertEquals("12:34:56", project.getDoneTime().toString());
    }

    @Test
    void markDoneDoesNotChangeExistingCompletionTime() {
        Project project = project();
        project.markDone(clockAt("2026-05-21T12:34:56Z"));

        project.markDone(clockAt("2026-05-22T08:00:00Z"));

        assertEquals("2026-05-21", project.getDoneDate().toString());
        assertEquals("12:34:56", project.getDoneTime().toString());
    }

    @Test
    void markDoneRejectsNullClock() {
        Project project = project();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> project.markDone(null));

        assertEquals("clock value 'null' is invalid; expected Clock", exception.getMessage());
    }

    @Test
    void resetStatusReturnsProjectToActive() {
        Project project = project();
        project.markDone(clockAt("2026-05-21T12:34:56Z"));

        project.resetStatus();

        assertEquals(ProjectStatus.ACTIVE, project.getStatus());
        assertNull(project.getDoneDate());
        assertNull(project.getDoneTime());
    }

    private Project project() {
        Item item = new Item(new Title("Publish release"), null);
        return new Project(item, LocalDate.parse("2026-06-01"));
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }
}
