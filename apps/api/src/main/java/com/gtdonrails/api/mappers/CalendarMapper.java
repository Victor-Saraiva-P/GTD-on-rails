package com.gtdonrails.api.mappers;

import com.gtdonrails.api.bodydocuments.ItemBodySource;
import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.entities.Calendar;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class CalendarMapper {

    private final ProjectAssociationMapper projectAssociationMapper;
    private final ItemBodySource itemBodySource;

    @Autowired
    public CalendarMapper(ProjectAssociationMapper projectAssociationMapper, ItemBodySource itemBodySource) {
        this.projectAssociationMapper = projectAssociationMapper;
        this.itemBodySource = itemBodySource;
    }

    public CalendarMapper() {
        this(new ProjectAssociationMapper(), ItemBodySource.legacy());
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
            itemBodySource.read(calendar.getItemId(), calendar.getItem().getBody()),
            calendar.getScheduledDate(),
            calendar.getScheduledTime(),
            calendar.getStatus().name(),
            calendar.getSchedule(),
            projectAssociationMapper.projectIdFor(calendar.getItem()),
            projectAssociationMapper.titleFor(calendar.getItem())
        );
    }

    public CalendarResponseDto toListResponse(Calendar calendar) {
        return new CalendarResponseDto(
            calendar.getItemId(),
            calendar.getItem().getTitle().value(),
            null,
            calendar.getScheduledDate(),
            calendar.getScheduledTime(),
            calendar.getStatus().name(),
            calendar.getSchedule(),
            projectAssociationMapper.projectIdFor(calendar.getItem()),
            projectAssociationMapper.titleFor(calendar.getItem())
        );
    }
}
