package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.entities.Calendar;
import org.springframework.stereotype.Component;

@Component
public class CalendarMapper {

    /**
     * Maps a Calendar entity into the Calendar API response.
     *
     * <p>Example: {@code calendarMapper.toResponse(calendar)}.</p>
     */
    public CalendarResponseDto toResponse(Calendar calendar) {
        return new CalendarResponseDto(
            calendar.getItemId(),
            calendar.getItem().getTitle().value(),
            calendar.getItem().getBody(),
            calendar.getScheduledDate(),
            calendar.getScheduledTime(),
            calendar.getStatus().name(),
            calendar.getSchedule()
        );
    }
}
