package com.gtdonrails.api.dtos.calendar;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.enums.CalendarEntrySourceKind;
import com.gtdonrails.api.enums.CalendarTemporalState;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.ScheduleWindow;

public record CalendarEntryResponseDto(
    UUID id,
    CalendarEntrySourceKind sourceKind,
    CalendarTemporalState temporalState,
    String title,
    ItemBody body,
    LocalDate scheduledDate,
    LocalTime scheduledTime,
    LocalDate deadline,
    String status,
    ScheduleWindow schedule,
    BigDecimal energy,
    Duration estimatedTime,
    List<ContextResponseDto> contexts,
    UUID projectId,
    String projectTitle
) {
}
