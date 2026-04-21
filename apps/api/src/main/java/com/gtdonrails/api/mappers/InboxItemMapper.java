package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.InboxItemResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.stereotype.Component;

@Component
public class InboxItemMapper {

    public InboxItemResponseDto toResponse(Item item) {
        return new InboxItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getBody() == null ? null : item.getBody().value(),
            item.getStatus().name()
        );
    }
}
