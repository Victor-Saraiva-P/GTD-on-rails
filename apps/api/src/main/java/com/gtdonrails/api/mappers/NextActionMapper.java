package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.entities.NextAction;
import org.springframework.stereotype.Component;

@Component
public class NextActionMapper {

    private final ContextMapper contextMapper;

    public NextActionMapper(ContextMapper contextMapper) {
        this.contextMapper = contextMapper;
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
                .toList()
        );
    }
}
