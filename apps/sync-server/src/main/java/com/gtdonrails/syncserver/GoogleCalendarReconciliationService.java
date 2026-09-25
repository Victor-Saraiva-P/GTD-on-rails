package com.gtdonrails.syncserver;

import java.util.List;
import java.util.Optional;

import com.google.api.services.calendar.model.CalendarListEntry;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarReconciliationService {

    static final String CALENDAR = "Calendar";
    static final String NEXT_ACTION = "Next Action";
    static final String PROJECT = "Project";
    static final String ONGOING = "On Going";
    static final String DONE = "Done";

    private static final List<CalendarDefinition> DEFINITIONS = List.of(
        new CalendarDefinition(NEXT_ACTION, "#4F9768"),
        new CalendarDefinition(CALENDAR, "#c85a53"),
        new CalendarDefinition(PROJECT, "#9B5AB7"),
        new CalendarDefinition(ONGOING, "#2D8C8A"),
        new CalendarDefinition(DONE, "#7F8D3F")
    );

    private final GoogleCalendarApi google;
    private final GoogleCalendarMirrorStore mirrors;

    public GoogleCalendarReconciliationService(
        GoogleCalendarApi google,
        GoogleCalendarMirrorStore mirrors
    ) {
        this.google = google;
        this.mirrors = mirrors;
    }

    public void reconcile() {
        List<CalendarListEntry> existing = google.calendars();
        for (CalendarDefinition definition : DEFINITIONS) {
            reconcileCalendar(definition, existing);
        }
    }

    public GoogleCalendarMirrorStore.CalendarMirror requiredCalendar(String name) {
        return mirrors.calendar(name)
            .orElseThrow(() -> new IllegalStateException(
                "Google Calendar mirror '" + name + "' is missing; expected reconciled integration"
            ));
    }

    private void reconcileCalendar(
        CalendarDefinition definition,
        List<CalendarListEntry> existing
    ) {
        String id = resolveCalendarId(definition.name(), existing);
        google.updateCalendarColor(id, definition.colorHex());
        mirrors.saveCalendar(definition.name(), id, definition.colorHex());
    }

    private String resolveCalendarId(String name, List<CalendarListEntry> existing) {
        Optional<String> persisted = mirrors.calendar(name)
            .map(GoogleCalendarMirrorStore.CalendarMirror::googleCalendarId)
            .filter(id -> calendarExists(existing, id));
        if (persisted.isPresent()) return persisted.get();

        return existing.stream()
            .filter(entry -> name.equals(entry.getSummary()))
            .map(CalendarListEntry::getId)
            .findFirst()
            .orElseGet(() -> google.createCalendar(name));
    }

    private boolean calendarExists(List<CalendarListEntry> existing, String id) {
        return existing.stream().anyMatch(entry -> id.equals(entry.getId()));
    }

    private record CalendarDefinition(String name, String colorHex) {
    }
}
