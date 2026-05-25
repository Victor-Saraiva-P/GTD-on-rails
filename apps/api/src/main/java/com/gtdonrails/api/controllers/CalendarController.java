package com.gtdonrails.api.controllers;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.dtos.calendar.PatchCalendarRequestDto;
import com.gtdonrails.api.services.CalendarService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/calendars")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping("/today")
    public List<CalendarResponseDto> getTodayCalendars() {
        return calendarService.getTodayCalendars();
    }

    @GetMapping("/done/today")
    public List<CalendarResponseDto> getDoneTodayCalendars() {
        return calendarService.getDoneTodayCalendars();
    }

    @GetMapping("/week")
    public List<CalendarResponseDto> getWeekCalendars(@RequestParam LocalDate start) {
        return calendarService.getWeekCalendars(start);
    }

    @GetMapping("/done")
    public List<CalendarResponseDto> getDoneCalendars() {
        return calendarService.getDoneCalendars();
    }

    @GetMapping("/deleted")
    public List<CalendarResponseDto> getDeletedCalendars() {
        return calendarService.getDeletedCalendars();
    }

    @GetMapping("/ongoing")
    public List<CalendarResponseDto> getOnGoingCalendars() {
        return calendarService.getOnGoingCalendars();
    }

    @PatchMapping("/{id}")
    public CalendarResponseDto patchCalendar(
        @PathVariable UUID id,
        @Valid @RequestBody PatchCalendarRequestDto request
    ) {
        return calendarService.patchCalendar(id, request);
    }

    @PostMapping("/{id}/ongoing")
    public CalendarResponseDto markOnGoing(@PathVariable UUID id) {
        return calendarService.markOnGoing(id);
    }

    @PostMapping("/{id}/done")
    public CalendarResponseDto markDone(@PathVariable UUID id) {
        return calendarService.markDone(id);
    }

    @PostMapping("/{id}/reset-status")
    public CalendarResponseDto resetCalendarStatus(@PathVariable UUID id) {
        return calendarService.resetCalendarStatus(id);
    }

    @PostMapping("/{id}/recover")
    public CalendarResponseDto recoverCalendar(@PathVariable UUID id) {
        return calendarService.recoverCalendar(id);
    }
}
