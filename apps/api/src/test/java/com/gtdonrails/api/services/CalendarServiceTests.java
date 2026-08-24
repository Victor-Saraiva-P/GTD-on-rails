package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.PatchCalendarRequestDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.mappers.CalendarMapper;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class CalendarServiceTests {

    private static final Clock CLOCK = clockAt("2026-05-21T12:00:00Z");

    @Mock
    private CalendarRepository calendarRepository;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    private CalendarService calendarService;
    private Calendar calendar;
    private UUID calendarId;

    @BeforeEach
    void setUp() {
        calendarId = UUID.randomUUID();
        calendar = calendar(calendarId);
        calendarService = new CalendarService(
            calendarRepository,
            new CalendarMapper(),
            CLOCK,
            googleCalendarEventQueueService,
            new AfterCommitExecutor());
        when(calendarRepository.findById(calendarId)).thenReturn(Optional.of(calendar));
        when(calendarRepository.save(any(Calendar.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void patchCalendarSyncsGoogleCalendarEvent() {
        calendarService.patchCalendar(calendarId, new PatchCalendarRequestDto("2026-05-22", "10:15"));

        assertEquals(LocalDate.parse("2026-05-22"), calendar.getScheduledDate());
        assertEquals(LocalTime.parse("10:15"), calendar.getScheduledTime());
        verifyGoogleCalendarSync();
    }

    @Test
    void markOnGoingSyncsGoogleCalendarEvent() {
        calendarService.markOnGoing(calendarId);

        assertEquals(CalendarStatus.ONGOING, calendar.getStatus());
        verifyGoogleCalendarSync();
    }

    @Test
    void markDoneSyncsGoogleCalendarEvent() {
        calendarService.markDone(calendarId);

        assertEquals(CalendarStatus.DONE, calendar.getStatus());
        verifyGoogleCalendarSync();
    }

    @Test
    void resetCalendarStatusSyncsGoogleCalendarEvent() {
        calendar.markOnGoing(CLOCK);

        calendarService.resetCalendarStatus(calendarId);

        assertEquals(CalendarStatus.CALENDAR, calendar.getStatus());
        verifyGoogleCalendarSync();
    }

    @Test
    void recoverCalendarSyncsGoogleCalendarEvent() {
        calendar.getItem().softDelete();

        calendarService.recoverCalendar(calendarId);

        verifyGoogleCalendarSync();
    }

    private void verifyGoogleCalendarSync() {
        verify(googleCalendarEventQueueService).requestUpsert(calendarId);
    }

    private Calendar calendar(UUID id) {
        Item item = new Item(new Title("Appointment"), null);
        ReflectionTestUtils.setField(item, "id", id);
        Calendar createdCalendar = new Calendar(item, LocalDate.parse("2026-05-21"), null);
        ReflectionTestUtils.setField(createdCalendar, "itemId", id);
        return createdCalendar;
    }

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
    }
}
