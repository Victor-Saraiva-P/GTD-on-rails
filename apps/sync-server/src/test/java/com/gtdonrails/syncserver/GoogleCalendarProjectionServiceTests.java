package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class GoogleCalendarProjectionServiceTests {

    @Test
    void nextActionDeadlineProjectsCanonicalStateToNextActionCalendar() {
        SyncObjectStore objects = mock(SyncObjectStore.class);
        GoogleCalendarApi google = mock(GoogleCalendarApi.class);
        GoogleCalendarReconciliationService calendars = mock(GoogleCalendarReconciliationService.class);
        GoogleCalendarMirrorStore mirrors = mock(GoogleCalendarMirrorStore.class);
        when(mirrors.hasAllCalendars()).thenReturn(true);
        when(calendars.requiredCalendar(GoogleCalendarReconciliationService.NEXT_ACTION))
            .thenReturn(new GoogleCalendarMirrorStore.CalendarMirror(
                GoogleCalendarReconciliationService.NEXT_ACTION,
                "next-action-calendar",
                "#4F9768"
            ));
        when(objects.object("items", "item-1")).thenReturn(Optional.of(snapshot(
            "items",
            "item-1",
            """
            {"id":"item-1","title":"Write report","status":"NEXT_ACTION","deleted_at":null}
            """
        )));
        when(objects.object("calendars", "item-1")).thenReturn(Optional.empty());
        when(objects.object("next_actions", "item-1")).thenReturn(Optional.of(snapshot(
            "next_actions",
            "item-1",
            """
            {"item_id":"item-1","deadline":"2026-09-30","status":"NEXT_ACTION","deleted_at":null}
            """
        )));

        GoogleCalendarProjectionService service = new GoogleCalendarProjectionService(
            objects,
            google,
            calendars,
            mirrors,
            new ObjectMapper()
        );

        service.project("item-1");

        verify(google).upsertEvent(
            eq("next-action-calendar"),
            argThat(event ->
                "Write report".equals(event.getSummary())
                    && "item1".equals(event.getId())
                    && "2026-09-30".equals(event.getStart().getDate().toStringRfc3339())
                    && "2026-10-01".equals(event.getEnd().getDate().toStringRfc3339())
            )
        );
    }

    private SyncObjectSnapshot snapshot(String type, String id, String payload) {
        return new SyncObjectSnapshot(
            type,
            id,
            1L,
            payload,
            null,
            null,
            "application/json",
            false
        );
    }
}
