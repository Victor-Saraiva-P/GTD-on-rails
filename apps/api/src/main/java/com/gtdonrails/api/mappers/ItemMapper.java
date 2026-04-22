package com.gtdonrails.api.mappers;

import java.util.Comparator;

import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.stereotype.Component;

@Component
public class ItemMapper {

    private final ContextMapper contextMapper;

    public ItemMapper(ContextMapper contextMapper) {
        this.contextMapper = contextMapper;
    }

    public ItemResponseDto toResponse(Item item) {
        return new ItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getBody() == null ? null : item.getBody().value(),
            item.getEnergy(),
            item.getStatus().name(),
            item.getCreatedAt(),
            item.getContexts().stream()
                .filter(context -> !context.isDeleted())
                .sorted(Comparator.comparing(context -> context.getName().toLowerCase()))
                .map(contextMapper::toResponse)
                .toList()
        );
    }

    public ContextItemResponseDto toContextItemResponse(Item item) {
        return new ContextItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getStatus().name()
        );
    }
}
