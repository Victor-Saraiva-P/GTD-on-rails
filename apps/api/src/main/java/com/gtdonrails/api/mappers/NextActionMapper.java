package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.entities.NextAction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class NextActionMapper {

    private final ContextMapper contextMapper;
    private final ProjectAssociationMapper projectAssociationMapper;

    @Autowired
    public NextActionMapper(ContextMapper contextMapper, ProjectAssociationMapper projectAssociationMapper) {
        this.contextMapper = contextMapper;
        this.projectAssociationMapper = projectAssociationMapper;
    }

    public NextActionMapper(ContextMapper contextMapper) {
        this(contextMapper, new ProjectAssociationMapper(null));
    }

    /**
     * Maps a NextAction entity into the Next Action API response.
     *
     * <p>Example: {@code nextActionMapper.toResponse(nextAction)}.</p>
     */
    public NextActionResponseDto toResponse(NextAction nextAction) {
        return new NextActionResponseDto(
            nextAction.getItemId(),
            nextAction.getItem().getTitle().value(),
            nextAction.getItem().getBody(),
            nextAction.getEnergy(),
            nextAction.getEstimatedTime(),
            nextAction.getDeadline(),
            nextAction.getStatus().name(),
            nextAction.getSchedule(),
            nextAction.getContexts().stream()
                .map(contextMapper::toResponse)
                .toList(),
            projectAssociationMapper.titleFor(nextAction.getItem())
        );
    }
}
