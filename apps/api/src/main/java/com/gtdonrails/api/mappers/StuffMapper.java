package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.inbox.StuffResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.stereotype.Component;

@Component
public class StuffMapper {

    /**
     * Maps a stuff item into the inbox-specific API response.
     *
     * <p>Example: {@code stuffMapper.toResponse(item)}.</p>
     */
    public StuffResponseDto toResponse(Item item) {
        return new StuffResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getBody(),
            item.getStatus().name(),
            item.getCreatedAt()
        );
    }
}
