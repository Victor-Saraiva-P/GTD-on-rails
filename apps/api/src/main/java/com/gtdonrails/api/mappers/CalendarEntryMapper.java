package com.gtdonrails.api.mappers;

import java.util.List;

import com.gtdonrails.api.dtos.calendar.CalendarEntryResponseDto;
import com.gtdonrails.api.dtos.calendar.CalendarResponseDto;
import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.CalendarEntrySourceKind;
import com.gtdonrails.api.enums.CalendarTemporalState;
import org.springframework.stereotype.Component;

@Component
public class CalendarEntryMapper {

    private final CalendarMapper calendarMapper;
    private final NextActionMapper nextActionMapper;

    public CalendarEntryMapper(CalendarMapper calendarMapper, NextActionMapper nextActionMapper) {
        this.calendarMapper = calendarMapper;
        this.nextActionMapper = nextActionMapper;
    }

    /**
     * Projects one Calendar Item into the aggregated Calendar read model.
     *
     * <p>Example: {@code mapper.fromCalendar(calendar, CalendarTemporalState.DUE_TODAY)}.</p>
     */
    public CalendarEntryResponseDto fromCalendar(Calendar calendar, CalendarTemporalState temporalState) {
        CalendarResponseDto response = calendarMapper.toListResponse(calendar);
        return new CalendarEntryResponseDto(
            response.id(), CalendarEntrySourceKind.CALENDAR, temporalState, response.title(), response.body(),
            response.scheduledDate(), response.scheduledTime(), null, response.status(), response.schedule(), null, null,
            List.of(), response.projectId(), response.projectTitle());
    }

    /**
     * Projects one Next Action into the aggregated Calendar read model.
     *
     * <p>Example: {@code mapper.fromNextAction(nextAction, CalendarTemporalState.OVERDUE)}.</p>
     */
    public CalendarEntryResponseDto fromNextAction(NextAction nextAction, CalendarTemporalState temporalState) {
        NextActionResponseDto response = nextActionMapper.toListResponse(nextAction);
        return new CalendarEntryResponseDto(
            response.id(), CalendarEntrySourceKind.NEXT_ACTION, temporalState, response.title(), response.body(),
            null, null, response.deadline(), response.status(), response.schedule(), response.energy(), response.estimatedTime(),
            response.contexts(), response.projectId(), response.projectTitle());
    }
}
