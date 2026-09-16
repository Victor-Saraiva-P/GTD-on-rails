package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.somedaymaybe.SomedayMaybeResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.stereotype.Component;

@Component
public class SomedayMaybeMapper {

    private final ProjectAssociationMapper projectAssociationMapper;

    public SomedayMaybeMapper(ProjectAssociationMapper projectAssociationMapper) {
        this.projectAssociationMapper = projectAssociationMapper;
    }

    /**
     * Maps an item into the someday/maybe-specific API response.
     *
     * <p>Example: {@code somedayMaybeMapper.toResponse(item)}.</p>
     */
    public SomedayMaybeResponseDto toResponse(Item item) {
        return new SomedayMaybeResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getBody(),
            item.getStatus().name(),
            item.getCreatedAt(),
            projectAssociationMapper.projectIdFor(item),
            projectAssociationMapper.titleFor(item)
        );
    }
}
