package com.gtdonrails.api.dtos.nextaction;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.ScheduleWindow;

public record NextActionResponseDto(
    UUID id,
    String title,
    ItemBody body,
    BigDecimal energy,
    Duration estimatedTime,
    String status,
    ScheduleWindow schedule,
    List<ContextResponseDto> contexts
) {
}
