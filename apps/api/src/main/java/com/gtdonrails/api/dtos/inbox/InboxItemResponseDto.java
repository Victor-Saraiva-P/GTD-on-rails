package com.gtdonrails.api.dtos.inbox;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;

public record InboxItemResponseDto(
    UUID id,
    String title,
    String body,
    String status,
    List<ContextResponseDto> contexts
) {
}
