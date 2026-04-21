package com.gtdonrails.api.dtos;

import java.util.UUID;

public record InboxItemResponseDto(
    UUID id,
    String title,
    String body,
    String status
) {
}
