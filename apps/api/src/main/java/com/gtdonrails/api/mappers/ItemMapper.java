package com.gtdonrails.api.mappers;

import java.util.Comparator;

import com.gtdonrails.api.bodydocuments.ItemBodySource;
import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.ItemTimeDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ItemMapper {

    private final ContextMapper contextMapper;
    private final ProjectAssociationMapper projectAssociationMapper;
    private final ItemBodySource itemBodySource;

    @Autowired
    public ItemMapper(
        ContextMapper contextMapper,
        ProjectAssociationMapper projectAssociationMapper,
        ItemBodySource itemBodySource
    ) {
        this.contextMapper = contextMapper;
        this.projectAssociationMapper = projectAssociationMapper;
        this.itemBodySource = itemBodySource;
    }

    public ItemMapper(ContextMapper contextMapper, ProjectAssociationMapper projectAssociationMapper) {
        this(contextMapper, projectAssociationMapper, ItemBodySource.legacy());
    }

    /**
     * Maps an item entity into the full item API response.
     *
     * <p>Example: {@code itemMapper.toResponse(item)}.</p>
     */
    public ItemResponseDto toResponse(Item item) {
        NextAction nextAction = item.getNextAction();

        return new ItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            itemBodySource.read(item.getId(), item.getBody()),
            nextAction == null ? null : nextAction.getEnergy(),
            toTimeDto(nextAction),
            item.getStatus().name(),
            item.getCreatedAt(),
            nextAction == null ? java.util.List.of() : nextAction.getContexts().stream()
                .filter(context -> !context.isDeleted())
                .sorted(Comparator.comparing(context -> context.getName().toLowerCase()))
                .map(contextMapper::toResponse)
                .toList(),
            projectAssociationMapper.projectIdFor(item),
            projectAssociationMapper.titleFor(item)
        );
    }

    /**
     * Maps an item entity into the compact response used inside context views.
     *
     * <p>Example: {@code itemMapper.toContextItemResponse(item)}.</p>
     */
    public ContextItemResponseDto toContextItemResponse(Item item) {
        return new ContextItemResponseDto(
            item.getId(),
            item.getTitle().value(),
            item.getStatus().name()
        );
    }

    private ItemTimeDto toTimeDto(NextAction nextAction) {
        if (nextAction == null) return null;
        long totalMinutes = nextAction.getEstimatedTime().toMinutes();
        return new ItemTimeDto(totalMinutes / 60, (int) (totalMinutes % 60));
    }
}
