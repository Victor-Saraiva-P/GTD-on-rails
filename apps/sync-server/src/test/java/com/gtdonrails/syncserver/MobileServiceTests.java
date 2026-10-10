package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MobileServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void captureCreatesCanonicalStuffItem() {
        SyncObjectStore store = store();
        MobileService service = new MobileService(store, new ObjectMapper());

        MobileCaptureResponse response = service.capture(new MobileCaptureRequest("  Buy   milk  "));

        SyncObjectSnapshot item = store.object("items", response.id()).orElseThrow();
        assertTrue(item.payload().contains("\"title\":\"Buy milk\""));
        assertTrue(item.payload().contains("\"status\":\"STUFF\""));
        assertEquals(1, response.revision());
    }

    @Test
    void bootstrapJoinsNextActionsContextsAndCalendar() {
        SyncObjectStore store = store();
        put(store, "items", "item-1", """
            {"id":"item-1","title":"Buy milk","status":"NEXT_ACTION","deleted_at":null}
            """);
        put(store, "contexts", "context-1", """
            {"id":"context-1","name":"Errands","deleted_at":null}
            """);
        put(store, "next_actions", "item-1", """
            {"item_id":"item-1","status":"NEXT_ACTION","energy":2.0,
             "estimated_time_minutes":15,"deadline":"2026-09-29","context_ids":["context-1"]}
            """);
        put(store, "items", "item-2", """
            {"id":"item-2","title":"Dentist","status":"CALENDAR","deleted_at":null}
            """);
        put(store, "calendars", "item-2", """
            {"item_id":"item-2","status":"CALENDAR",
             "scheduled_date":"2026-09-29","scheduled_time":"09:00:00"}
            """);

        MobileBootstrap bootstrap = new MobileService(store, new ObjectMapper()).bootstrap(LocalDate.parse("2026-09-29"));

        assertEquals("Errands", bootstrap.contexts().getFirst().name());
        assertEquals("Buy milk", bootstrap.nextActions().getFirst().title());
        assertEquals("context-1", bootstrap.nextActions().getFirst().contextIds().getFirst());
        assertEquals("Dentist", bootstrap.calendar().getFirst().title());
        assertEquals("2026-09-29", bootstrap.calendarLocalDate());
        assertEquals(2, bootstrap.calendarEntries().size());
        assertEquals("CALENDAR", bootstrap.calendarEntries().get(0).sourceKind());
        assertEquals("SCHEDULED_TODAY", bootstrap.calendarEntries().get(0).temporalState());
        assertEquals("NEXT_ACTION", bootstrap.calendarEntries().get(1).sourceKind());
        assertEquals("DUE_TODAY", bootstrap.calendarEntries().get(1).temporalState());
    }

    @Test
    void bootstrapExcludesSoftDeletedCalendarAndNextActionItems() {
        SyncObjectStore store = store();
        put(store, "items", "action-1", """
            {"id":"action-1","title":"Deleted action","status":"NEXT_ACTION","deleted_at":"2026-09-29T12:00:00Z"}
            """);
        put(store, "next_actions", "action-1", """
            {"item_id":"action-1","status":"NEXT_ACTION","deadline":"2026-09-29","context_ids":[]}
            """);
        put(store, "items", "calendar-1", """
            {"id":"calendar-1","title":"Deleted appointment","status":"CALENDAR","deleted_at":"2026-09-29T12:00:00Z"}
            """);
        put(store, "calendars", "calendar-1", """
            {"item_id":"calendar-1","status":"CALENDAR","scheduled_date":"2026-09-29","scheduled_time":null}
            """);

        MobileBootstrap bootstrap = new MobileService(store, new ObjectMapper()).bootstrap(LocalDate.parse("2026-09-29"));

        assertTrue(bootstrap.nextActions().isEmpty());
        assertTrue(bootstrap.calendar().isEmpty());
        assertTrue(bootstrap.calendarEntries().isEmpty());
    }

    @Test
    void captureRejectsBlankTitle() {
        MobileService service = new MobileService(store(), new ObjectMapper());

        IllegalArgumentException exception = org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> service.capture(new MobileCaptureRequest("   "))
        );

        assertTrue(exception.getMessage().contains("expected 1 to 200 characters"));
    }

    private SyncObjectStore store() {
        return new SyncObjectStore(tempDirectory.resolve("canonical.db"));
    }

    private void put(SyncObjectStore store, String type, String id, String payload) {
        store.apply(new SyncMutation(
            UUID.randomUUID(),
            type,
            id,
            0,
            "UPSERT",
            payload,
            null,
            null,
            "application/json"
        ));
    }
}
