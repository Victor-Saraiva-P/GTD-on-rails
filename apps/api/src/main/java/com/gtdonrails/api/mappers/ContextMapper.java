package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.services.AssetStorageService;
import org.springframework.stereotype.Component;

@Component
public class ContextMapper {

    private final AssetStorageService assetStorageService;
    private final ContextIconAssetRepository contextIconAssetRepository;

    public ContextMapper(AssetStorageService assetStorageService, ContextIconAssetRepository contextIconAssetRepository) {
        this.assetStorageService = assetStorageService;
        this.contextIconAssetRepository = contextIconAssetRepository;
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
            iconUrl(context)
        );
    }

    private String iconUrl(Context context) {
        return contextIconAssetRepository.findByContextIdAndDeletedAtIsNull(context.getId())
            .map(ContextIconAsset::relativePath)
            .map(assetStorageService::publicUrl)
            .orElse(null);
    }
}
