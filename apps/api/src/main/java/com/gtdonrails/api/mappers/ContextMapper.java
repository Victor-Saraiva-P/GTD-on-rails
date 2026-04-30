package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.services.AssetStorageService;
import org.springframework.stereotype.Component;

@Component
public class ContextMapper {

    private final AssetStorageService assetStorageService;

    public ContextMapper(AssetStorageService assetStorageService) {
        this.assetStorageService = assetStorageService;
    }

    /**
     * Maps a context entity into the context API response.
     *
     * <p>Example: {@code contextMapper.toResponse(context)}.</p>
     */
    public ContextResponseDto toResponse(Context context) {
        return new ContextResponseDto(
            context.getId(),
            context.getName(),
            assetStorageService.publicUrl(context.getIconAssetPath())
        );
    }
}
