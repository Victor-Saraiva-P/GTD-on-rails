package com.gtdonrails.api.mappers;

import com.gtdonrails.api.bodydocuments.ItemBodySource;
import com.gtdonrails.api.dtos.inbox.StuffResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class StuffMapper {

    private final ProjectAssociationMapper projectAssociationMapper;
    private final ItemBodySource itemBodySource;

    @Autowired
    public StuffMapper(ProjectAssociationMapper projectAssociationMapper, ItemBodySource itemBodySource) {
        this.projectAssociationMapper = projectAssociationMapper;
        this.itemBodySource = itemBodySource;
    }

    public StuffMapper(ProjectAssociationMapper projectAssociationMapper) {
        this(projectAssociationMapper, ItemBodySource.legacy());
    }

    /**
     * Maps a stuff item into the inbox-specific API response.
     *
     * <p>Example: {@code stuffMapper.toResponse(item)}.</p>
     */
    public StuffResponseDto toResponse(Item item) {
        return new StuffResponseDto(
            item.getId(),
            item.getTitle().value(),
            itemBodySource.read(item.getId(), item.getBody()),
            item.getStatus().name(),
            item.getCreatedAt(),
            projectAssociationMapper.projectIdFor(item),
            projectAssociationMapper.titleFor(item)
        );
    }
}
