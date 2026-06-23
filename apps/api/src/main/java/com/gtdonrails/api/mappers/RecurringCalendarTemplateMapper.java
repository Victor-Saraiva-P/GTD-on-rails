package com.gtdonrails.api.mappers;

import java.time.DayOfWeek;

import com.gtdonrails.api.dtos.recurring.RecurringCalendarTemplateResponseDto;
import com.gtdonrails.api.entities.RecurringCalendarTemplate;
import org.springframework.stereotype.Component;

@Component
public class RecurringCalendarTemplateMapper {

    /**
     * Maps a Recurring Calendar Template entity into the API response.
     *
     * <p>Example: {@code mapper.toResponse(template)}.</p>
     */
    public RecurringCalendarTemplateResponseDto toResponse(RecurringCalendarTemplate template) {
        return new RecurringCalendarTemplateResponseDto(
            template.getItemId(),
            template.getItem().getTitle().value(),
            template.getItem().getBody(),
            template.getStartDate(),
            template.getScheduledTime(),
            template.getIntervalValue(),
            template.getRecurrenceUnit().toWire(),
            template.weeklyWeekdays().stream().map(DayOfWeek::name).toList(),
            template.getEndDate()
        );
    }
}
