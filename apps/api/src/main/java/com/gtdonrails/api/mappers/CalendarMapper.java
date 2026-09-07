package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.entities.Calendar;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class CalendarMapper {

    private final ProjectAssociationMapper projectAssociationMapper;

    @Autowired
    public CalendarMapper(ProjectAssociationMapper projectAssociationMapper) {
        this.projectAssociationMapper = projectAssociationMapper;
    }

    public CalendarMapper() {
        this(new ProjectAssociationMapper(null));
    }

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
            calendar.getSchedule(),
            projectAssociationMapper.titleFor(calendar.getItem())
        );
    }
}
