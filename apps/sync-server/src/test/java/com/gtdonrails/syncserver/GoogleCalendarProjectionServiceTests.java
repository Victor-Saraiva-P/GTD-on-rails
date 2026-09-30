package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class GoogleCalendarProjectionServiceTests {

    @Test
    void nextActionDeadlineProjectsCanonicalStateToNextActionCalendar() {
        assertStartDate(fixture("""
            {"item_id":"item-1","deadline":"2026-09-30","status":"NEXT_ACTION","deleted_at":null}
            """), "next-action-calendar", "2026-09-30");
    }

    @Test
    void epochMillisDeadlineProjectsAsLocalDate() {
        assertStartDate(fixture("""
            {"item_id":"item-1","deadline":1782270000000,"status":"NEXT_ACTION","deleted_at":null}
            """), "next-action-calendar", "2026-06-24");
    }

    @Test
    void epochMillisUpdateTimestampProjectsDoneDate() {
        assertStartDate(fixture("""
            {"item_id":"item-1","deadline":null,"date_start":null,"date_end":null,"status":"DONE","updated_at":1782270000000,"deleted_at":null}
            """), "done-calendar", "2026-06-24");
    }

    @Test
    void invalidDeadlineExplainsValueAndExpectedDateShape() {
        ProjectionFixture fixture = fixture("""
            {"item_id":"item-1","deadline":"tomorrow-ish","status":"NEXT_ACTION","deleted_at":null}
            """);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> fixture.service().project("item-1")
        );

        assertTrue(exception.getMessage().contains("deadline"));
        assertTrue(exception.getMessage().contains("tomorrow-ish"));
        assertTrue(exception.getMessage().contains("ISO-8601 date or epoch milliseconds"));
    }

    private void assertStartDate(ProjectionFixture fixture, String calendarId, String date) {
        fixture.service().project("item-1");
        verify(fixture.google()).upsertEvent(eq(calendarId), argThat(event ->
            "Write report".equals(event.getSummary())
                && "item1".equals(event.getId())
                && date.equals(event.getStart().getDate().toStringRfc3339())
                && LocalDate.parse(date).plusDays(1).toString().equals(event.getEnd().getDate().toStringRfc3339())
        ));
    }

    private ProjectionFixture fixture(String nextActionPayload) {
        SyncObjectStore objects = mock(SyncObjectStore.class);
        GoogleCalendarApi google = mock(GoogleCalendarApi.class);
        GoogleCalendarReconciliationService calendars = mock(GoogleCalendarReconciliationService.class);
        GoogleCalendarMirrorStore mirrors = mock(GoogleCalendarMirrorStore.class);
        when(mirrors.hasAllCalendars()).thenReturn(true);
        stubCalendar(calendars, GoogleCalendarReconciliationService.NEXT_ACTION, "next-action-calendar");
        stubCalendar(calendars, GoogleCalendarReconciliationService.DONE, "done-calendar");
        stubObjects(objects, nextActionPayload);
        return new ProjectionFixture(new GoogleCalendarProjectionService(
            objects, google, calendars, mirrors, new ObjectMapper()
        ), google);
    }

    private void stubObjects(SyncObjectStore objects, String nextActionPayload) {
        when(objects.object("items", "item-1")).thenReturn(Optional.of(snapshot(
            "items", "item-1", "{\"id\":\"item-1\",\"title\":\"Write report\",\"deleted_at\":null}"
        )));
        when(objects.object("calendars", "item-1")).thenReturn(Optional.empty());
        when(objects.object("next_actions", "item-1")).thenReturn(Optional.of(snapshot(
            "next_actions", "item-1", nextActionPayload
        )));
    }

    private void stubCalendar(GoogleCalendarReconciliationService calendars, String name, String calendarId) {
        when(calendars.requiredCalendar(name)).thenReturn(new GoogleCalendarMirrorStore.CalendarMirror(
            name, calendarId, "#4F9768"
        ));
    }

    private SyncObjectSnapshot snapshot(String type, String id, String payload) {
        return new SyncObjectSnapshot(type, id, 1L, payload, null, null, "application/json", false);
    }

    private record ProjectionFixture(GoogleCalendarProjectionService service, GoogleCalendarApi google) {
    }
}
