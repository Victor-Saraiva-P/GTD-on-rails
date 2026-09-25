package com.gtdonrails.api.mappers;

import com.gtdonrails.api.bodydocuments.ItemBodySource;
import com.gtdonrails.api.dtos.somedaymaybe.SomedayMaybeResponseDto;
import com.gtdonrails.api.entities.Item;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class SomedayMaybeMapper {

    private final ProjectAssociationMapper projectAssociationMapper;
    private final ItemBodySource itemBodySource;

    @Autowired
    public SomedayMaybeMapper(ProjectAssociationMapper projectAssociationMapper, ItemBodySource itemBodySource) {
        this.projectAssociationMapper = projectAssociationMapper;
        this.itemBodySource = itemBodySource;
    }

    public SomedayMaybeMapper(ProjectAssociationMapper projectAssociationMapper) {
        this(projectAssociationMapper, ItemBodySource.legacy());
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
            itemBodySource.read(item.getId(), item.getBody()),
            item.getStatus().name(),
            item.getCreatedAt(),
            projectAssociationMapper.projectIdFor(item),
            projectAssociationMapper.titleFor(item)
        );
    }

    public SomedayMaybeResponseDto toListResponse(Item item) {
        return new SomedayMaybeResponseDto(
            item.getId(),
            item.getTitle().value(),
            null,
            item.getStatus().name(),
            item.getCreatedAt(),
            projectAssociationMapper.projectIdFor(item),
            projectAssociationMapper.titleFor(item)
        );
    }
}
