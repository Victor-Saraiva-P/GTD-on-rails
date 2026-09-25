package com.gtdonrails.syncserver;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarProjectionService {

    private static final List<String> CALENDAR_NAMES = List.of(
        GoogleCalendarReconciliationService.CALENDAR,
        GoogleCalendarReconciliationService.NEXT_ACTION,
        GoogleCalendarReconciliationService.PROJECT,
        GoogleCalendarReconciliationService.ONGOING,
        GoogleCalendarReconciliationService.DONE
    );

    private final SyncObjectStore objects;
    private final GoogleCalendarApi google;
    private final GoogleCalendarReconciliationService calendars;
    private final GoogleCalendarMirrorStore mirrors;
    private final ObjectMapper mapper;

    public GoogleCalendarProjectionService(
        SyncObjectStore objects,
        GoogleCalendarApi google,
        GoogleCalendarReconciliationService calendars,
        GoogleCalendarMirrorStore mirrors,
        ObjectMapper mapper
    ) {
        this.objects = objects;
        this.google = google;
        this.calendars = calendars;
        this.mirrors = mirrors;
        this.mapper = mapper;
    }

    public void project(String itemId) {
        if (!mirrors.hasAllCalendars()) calendars.reconcile();
        Optional<JsonNode> item = payload("items", itemId);
        if (item.isEmpty() || deleted(item.get())) {
            deleteEverywhere(itemId);
            return;
        }

        JsonNode value = item.get();
        if (projectCalendar(itemId, value)) return;
        if (projectNextAction(itemId, value)) return;
        if (projectProject(itemId, value)) return;
        deleteEverywhere(itemId);
    }

    private boolean projectCalendar(String itemId, JsonNode item) {
        Optional<JsonNode> calendar = payload("calendars", itemId);
        if (calendar.isEmpty() || deleted(calendar.get())) return false;
        String status = text(calendar.get(), "status");
        String target = "DONE".equals(status)
            ? GoogleCalendarReconciliationService.DONE
            : "ONGOING".equals(status)
                ? GoogleCalendarReconciliationService.ONGOING
                : GoogleCalendarReconciliationService.CALENDAR;
        Event event = calendarEvent(itemId, title(item), calendar.get(), status);
        upsertOnly(target, event);
        return true;
    }

    private boolean projectNextAction(String itemId, JsonNode item) {
        Optional<JsonNode> action = payload("next_actions", itemId);
        if (action.isEmpty() || deleted(action.get())) return false;
        JsonNode value = action.get();
        String status = text(value, "status");
        if ("NEXT_ACTION".equals(status) && blank(text(value, "deadline"))) {
            deleteEverywhere(itemId);
            return true;
        }

        String target = "DONE".equals(status)
            ? GoogleCalendarReconciliationService.DONE
            : "ONGOING".equals(status)
                ? GoogleCalendarReconciliationService.ONGOING
                : GoogleCalendarReconciliationService.NEXT_ACTION;
        Event event = nextActionEvent(itemId, title(item), value, status);
        upsertOnly(target, event);
        return true;
    }

    private boolean projectProject(String itemId, JsonNode item) {
        Optional<JsonNode> project = payload("projects", itemId);
        if (project.isEmpty() || deleted(project.get())) return false;
        JsonNode value = project.get();
        String deadline = text(value, "deadline");
        if (blank(deadline)) {
            deleteEverywhere(itemId);
            return true;
        }
        String target = "DONE".equals(text(value, "status"))
            ? GoogleCalendarReconciliationService.DONE
            : GoogleCalendarReconciliationService.PROJECT;
        upsertOnly(target, allDayEvent(itemId, title(item), LocalDate.parse(deadline), LocalDate.parse(deadline)));
        return true;
    }

    private Event calendarEvent(String itemId, String title, JsonNode calendar, String status) {
        if ("DONE".equals(status)) return scheduleEvent(itemId, title, calendar);
        LocalDate date = LocalDate.parse(text(calendar, "scheduled_date"));
        String time = text(calendar, "scheduled_time");
        if (blank(time)) return allDayEvent(itemId, title, date, date);
        LocalDateTime start = LocalDateTime.parse(date + "T" + time);
        return timedEvent(itemId, title, start, start.plusMinutes(30));
    }

    private Event nextActionEvent(String itemId, String title, JsonNode action, String status) {
        if ("NEXT_ACTION".equals(status)) {
            LocalDate deadline = LocalDate.parse(text(action, "deadline"));
            return allDayEvent(itemId, title, deadline, deadline);
        }
        if ("ONGOING".equals(status)) {
            LocalDateTime start = scheduleStart(action);
            return timedEvent(itemId, title, start, start.plusMinutes(30));
        }
        if (hasSchedule(action)) return scheduleEvent(itemId, title, action);
        LocalDate completed = updatedDate(action);
        return allDayEvent(itemId, title, completed, completed);
    }

    private Event scheduleEvent(String itemId, String title, JsonNode value) {
        LocalDate startDate = LocalDate.parse(text(value, "date_start"));
        LocalDate endDate = LocalDate.parse(text(value, "date_end"));
        if (value.path("all_day").asBoolean(false)) {
            return allDayEvent(itemId, title, startDate, endDate);
        }
        LocalDateTime start = LocalDateTime.parse(startDate + "T" + text(value, "time_start"));
        LocalDateTime end = LocalDateTime.parse(endDate + "T" + text(value, "time_end"));
        return timedEvent(itemId, title, start, end);
    }

    private LocalDateTime scheduleStart(JsonNode value) {
        return LocalDateTime.parse(text(value, "date_start") + "T" + text(value, "time_start"));
    }

    private boolean hasSchedule(JsonNode value) {
        return !blank(text(value, "date_start")) && !blank(text(value, "date_end"));
    }

    private LocalDate updatedDate(JsonNode value) {
        String updatedAt = text(value, "updated_at");
        if (blank(updatedAt)) return LocalDate.now();
        return java.time.Instant.parse(updatedAt).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private void upsertOnly(String targetName, Event event) {
        String targetId = calendars.requiredCalendar(targetName).googleCalendarId();
        google.upsertEvent(targetId, event);
        for (String name : CALENDAR_NAMES) {
            if (!name.equals(targetName)) deleteFrom(name, event.getId());
        }
    }

    private void deleteEverywhere(String itemId) {
        String eventId = eventId(itemId);
        for (String name : CALENDAR_NAMES) deleteFrom(name, eventId);
    }

    private void deleteFrom(String name, String eventId) {
        mirrors.calendar(name).ifPresent(calendar ->
            google.deleteEvent(calendar.googleCalendarId(), eventId)
        );
    }

    private Optional<JsonNode> payload(String type, String id) {
        return objects.object(type, id)
            .filter(snapshot -> !snapshot.deleted())
            .flatMap(this::parsePayload);
    }

    private Optional<JsonNode> parsePayload(SyncObjectSnapshot snapshot) {
        if (blank(snapshot.payload())) return Optional.empty();
        try {
            return Optional.of(mapper.readTree(snapshot.payload()));
        } catch (Exception exception) {
            throw new IllegalStateException(
                "Canonical payload for '" + snapshot.objectType() + ":" + snapshot.objectId()
                    + "' is invalid; expected JSON",
                exception
            );
        }
    }

    private Event allDayEvent(String itemId, String title, LocalDate start, LocalDate endInclusive) {
        Event event = baseEvent(itemId, title);
        event.setStart(new EventDateTime().setDate(new DateTime(start.toString())));
        event.setEnd(new EventDateTime().setDate(new DateTime(endInclusive.plusDays(1).toString())));
        return event;
    }

    private Event timedEvent(String itemId, String title, LocalDateTime start, LocalDateTime end) {
        ZoneId zone = ZoneId.systemDefault();
        Event event = baseEvent(itemId, title);
        event.setStart(dateTime(start, zone));
        event.setEnd(dateTime(end, zone));
        return event;
    }

    private EventDateTime dateTime(LocalDateTime value, ZoneId zone) {
        Date date = Date.from(value.atZone(zone).toInstant());
        return new EventDateTime().setDateTime(new DateTime(date)).setTimeZone(zone.getId());
    }

    private Event baseEvent(String itemId, String title) {
        return new Event().setId(eventId(itemId)).setSummary(title);
    }

    private String eventId(String itemId) {
        return itemId.replace("-", "");
    }

    private String title(JsonNode item) {
        String title = text(item, "title");
        return blank(title) ? "Untitled" : title;
    }

    private boolean deleted(JsonNode value) {
        return !value.path("deleted_at").isMissingNode() && !value.path("deleted_at").isNull();
    }

    private String text(JsonNode value, String field) {
        JsonNode node = value.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
