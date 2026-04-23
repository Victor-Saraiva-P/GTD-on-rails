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

    public ContextResponseDto toResponse(Context context) {
        return new ContextResponseDto(
            context.getId(),
            context.getName(),
            assetStorageService.publicUrl(context.getIconAssetPath())
        );
    }
}
