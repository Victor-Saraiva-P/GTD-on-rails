package com.gtdonrails.api.mappers;

import java.util.Comparator;

import com.gtdonrails.api.dtos.inbox.InboxItemResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.stereotype.Component;

@Component
public class InboxItemMapper {

    private final ContextMapper contextMapper;

    public InboxItemMapper(ContextMapper contextMapper) {
        this.contextMapper = contextMapper;
    }

    public InboxItemResponseDto toResponse(Item item) {
        return new InboxItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getBody() == null ? null : item.getBody().value(),
            item.getStatus().name(),
            item.getContexts().stream()
                .filter(context -> !context.isDeleted())
                .sorted(Comparator.comparing(context -> context.getName().toLowerCase()))
                .map(contextMapper::toResponse)
                .toList()
        );
    }
}
