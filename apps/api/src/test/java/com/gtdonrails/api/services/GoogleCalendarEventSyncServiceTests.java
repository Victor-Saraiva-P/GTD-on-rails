package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@Tag("unit")
class GoogleCalendarEventSyncServiceTests {

    private GoogleCalendarService googleCalendarService;
    private CalendarRepository calendarRepository;
    private GoogleCalendarRepository googleCalendarRepository;
    private FakeGoogleCalendarEventGateway eventGateway;
    private GoogleCalendarEventSyncService syncService;

    @BeforeEach
    void setUp() {
        googleCalendarService = mock(GoogleCalendarService.class);
        calendarRepository = mock(CalendarRepository.class);
        googleCalendarRepository = mock(GoogleCalendarRepository.class);
        eventGateway = new FakeGoogleCalendarEventGateway();
        syncService = new GoogleCalendarEventSyncService(
            googleCalendarService,
            calendarRepository,
            googleCalendarRepository,
            eventGateway);
        when(googleCalendarService.getValidCredential()).thenReturn(new GoogleCredential());
        stubGoogleCalendar("Calendar", "google-calendar-id");
        stubGoogleCalendar("On Going", "google-ongoing-id");
        stubGoogleCalendar("Done", "google-done-id");
    }

    @Test
    void syncCalendarAllDayEventDeletesStaleStatusEvents() {
        Calendar calendar = calendarWithId("Doctor appointment", null);

        syncService.syncCalendarEvent(calendar);

        assertEquals("google-calendar-id", eventGateway.upserts.getFirst().googleCalendarId());
        assertEquals(LocalDate.parse("2026-05-21"), eventGateway.upserts.getFirst().allDayStartDate());
        assertEquals(LocalDate.parse("2026-05-22"), eventGateway.upserts.getFirst().allDayEndDate());
        assertEquals(List.of("google-ongoing-id", "google-done-id"), eventGateway.deletedCalendarIds());
    }

    @Test
    void syncCalendarTimedEventEndsThirtyMinutesAfterStart() {
        Calendar calendar = calendarWithId("Dentist appointment", LocalTime.parse("09:30"));

        syncService.syncCalendarEvent(calendar);

        GoogleCalendarEventRequest request = eventGateway.upserts.getFirst();
        assertEquals(LocalDateTime.parse("2026-05-21T09:30"), request.dateTimeStart());
        assertEquals(LocalDateTime.parse("2026-05-21T10:00"), request.dateTimeEnd());
    }

    @Test
    void syncOngoingEventMovesFromCalendar() {
        Calendar calendar = calendarWithId("Write report", LocalTime.parse("14:00"));
        calendar.markOnGoing(clockAt("2026-05-21T08:00:00Z"));

        syncService.syncCalendarEvent(calendar);

        assertEquals("google-ongoing-id", eventGateway.upserts.getFirst().googleCalendarId());
        assertEquals(List.of("google-calendar-id", "google-done-id"), eventGateway.deletedCalendarIds());
    }

    @Test
    void syncDoneAllDayEventUsesScheduleWindow() {
        Calendar calendar = calendarWithId("Submit taxes", null);
        calendar.markDone(clockAt("2026-05-22T15:30:00Z"));

        syncService.syncCalendarEvent(calendar);

        GoogleCalendarEventRequest request = eventGateway.upserts.getFirst();
        assertEquals("google-done-id", request.googleCalendarId());
        assertEquals(LocalDate.parse("2026-05-22"), request.allDayStartDate());
        assertEquals(LocalDate.parse("2026-05-23"), request.allDayEndDate());
    }

    @Test
    void syncDoneTimedEventUsesExactScheduleWindow() {
        Calendar calendar = calendarWithId("Deep work", null);
        calendar.markOnGoing(clockAt("2026-05-22T08:15:00Z"));
        calendar.markDone(clockAt("2026-05-22T09:45:00Z"));

        syncService.syncCalendarEvent(calendar);

        GoogleCalendarEventRequest request = eventGateway.upserts.getFirst();
        assertEquals(LocalDateTime.parse("2026-05-22T08:15"), request.dateTimeStart());
        assertEquals(LocalDateTime.parse("2026-05-22T09:45"), request.dateTimeEnd());
    }

    @Test
    void syncSkipsWhenGoogleIsNotConnected() {
        when(googleCalendarService.getValidCredential()).thenReturn(null);

        syncService.syncCalendarEvent(calendarWithId("No external sync", null));

        assertTrue(eventGateway.upserts.isEmpty());
        assertTrue(eventGateway.deletes.isEmpty());
    }

    @Test
    void syncSkipsWhenGtdCalendarIdsAreMissing() {
        when(googleCalendarRepository.findByName("Done")).thenReturn(null);

        syncService.syncCalendarEvent(calendarWithId("Missing done calendar", null));

        assertTrue(eventGateway.upserts.isEmpty());
        assertTrue(eventGateway.deletes.isEmpty());
    }

    @Test
    void syncCalendarEventByItemIdLoadsLatestActiveCalendar() {
        UUID itemId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        Calendar calendar = calendarWithId("Latest title", LocalTime.parse("11:15"));
        when(calendarRepository.findByItemIdAndItem_DeletedAtIsNull(itemId)).thenReturn(Optional.of(calendar));

        syncService.syncCalendarEvent(itemId);

        assertEquals("Latest title", eventGateway.upserts.getFirst().title());
        assertEquals(LocalDateTime.parse("2026-05-21T11:15"), eventGateway.upserts.getFirst().dateTimeStart());
    }

    @Test
    void syncCalendarEventByItemIdSkipsMissingActiveCalendar() {
        UUID itemId = UUID.randomUUID();
        when(calendarRepository.findByItemIdAndItem_DeletedAtIsNull(itemId)).thenReturn(Optional.empty());

        syncService.syncCalendarEvent(itemId);

        assertTrue(eventGateway.upserts.isEmpty());
        assertTrue(eventGateway.deletes.isEmpty());
    }

    @Test
    void deleteCalendarEventByItemIdRemovesAllGtdGoogleEvents() {
        UUID itemId = UUID.fromString("11111111-2222-3333-4444-555555555555");

        syncService.deleteCalendarEvent(itemId);

        assertEquals(
            List.of("google-calendar-id", "google-ongoing-id", "google-done-id"),
            eventGateway.deletedCalendarIds());
    }

    @Test
    void syncRejectsUnsavedCalendarWithoutItemId() {
        Calendar calendar = new Calendar(new Item(new Title("Unsaved"), null), LocalDate.now(), null);

        IllegalArgumentException exception = org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> syncService.syncCalendarEvent(calendar));

        assertEquals("calendar itemId value 'null' is invalid; expected persisted UUID", exception.getMessage());
    }

    private void stubGoogleCalendar(String name, String googleCalendarId) {
        com.gtdonrails.api.entities.GoogleCalendar googleCalendar = new com.gtdonrails.api.entities.GoogleCalendar();
        googleCalendar.setName(name);
        googleCalendar.setGoogleCalendarId(googleCalendarId);
        when(googleCalendarRepository.findByName(name)).thenReturn(googleCalendar);
    }

    private Calendar calendarWithId(String title, LocalTime scheduledTime) {
        Item item = new Item(new Title(title), null);
        UUID itemId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        ReflectionTestUtils.setField(item, "id", itemId);
        Calendar calendar = new Calendar(item, LocalDate.parse("2026-05-21"), scheduledTime);
        ReflectionTestUtils.setField(calendar, "itemId", itemId);
        return calendar;
    }

    private Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }

    private static class FakeGoogleCalendarEventGateway implements GoogleCalendarEventGateway {

        private final List<GoogleCalendarEventRequest> upserts = new ArrayList<>();
        private final List<GoogleCalendarEventDeleteRequest> deletes = new ArrayList<>();

        @Override
        public void upsertEvent(GoogleCalendarEventRequest request) {
            upserts.add(request);
        }

        @Override
        public void deleteEvent(GoogleCalendarEventDeleteRequest request) {
            deletes.add(request);
        }

        private List<String> deletedCalendarIds() {
            return deletes.stream().map(GoogleCalendarEventDeleteRequest::googleCalendarId).toList();
        }
    }
}
