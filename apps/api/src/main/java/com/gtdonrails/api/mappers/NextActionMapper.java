package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.nextaction.NextActionResponseDto;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.services.AssetStorageService;
import org.springframework.stereotype.Component;

@Component
public class NextActionMapper {

    private final AssetStorageService assetStorageService;

    public NextActionMapper(AssetStorageService assetStorageService) {
        this.assetStorageService = assetStorageService;
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
            nextAction.getStatus().name(),
            nextAction.getSchedule(),
            nextAction.getContexts().stream()
                .map(context -> new ContextResponseDto(
                    context.getId(),
                    context.getName(),
                    assetStorageService.publicUrl(context.getIconAssetPath())
                ))
                .toList()
        );
    }
}
