package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CopyLocalItemAssetRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemAssetServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ItemAssetRepository itemAssetRepository;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private AssetSyncService assetSyncService;

    private ItemAssetService itemAssetService;

    @BeforeEach
    void setUp() {
        itemAssetService = new ItemAssetService(
            itemRepository,
            itemAssetRepository,
            assetStorageService,
            assetSyncService,
            new AfterCommitExecutor());
    }

    @Test
    void storeLocalItemAssetCopiesFileAndRequestsAssetSync() {
        UUID itemId = UUID.randomUUID();
        Path sourcePath = Path.of("/home/victor/Downloads/report.pdf");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(new Item(new Title("Capture idea"), null)));
        when(assetStorageService.copyLocalItemAsset(eq(itemId), any(Path.class))).thenReturn("items/id/asset/report.pdf");
        when(assetStorageService.fileName("items/id/asset/report.pdf")).thenReturn("report.pdf");
        when(assetStorageService.mediaType("items/id/asset/report.pdf")).thenReturn(org.springframework.http.MediaType.APPLICATION_PDF);
        when(assetStorageService.publicUrl("items/id/asset/report.pdf")).thenReturn("/assets/items/id/asset/report.pdf");
        when(itemAssetRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ItemAssetResponseDto response = itemAssetService.storeLocalItemAsset(itemId, new CopyLocalItemAssetRequestDto(sourcePath.toString()));

        assertEquals("report.pdf", response.fileName());
        assertEquals("application/pdf", response.contentType());
        verify(assetSyncService).requestSync("local item asset copied");
    }

    @Test
    void validateBodyAssetOwnershipRejectsAssetOwnedByOtherItem() {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        when(itemAssetRepository.existsByIdAndItemId(assetId, itemId)).thenReturn(false);

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> itemAssetService.validateBodyAssetOwnership(itemId, bodyWithBlockEntity(assetId.toString())));

        assertEquals(
            "body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'",
            exception.getMessage());
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody("file", List.of(), List.of(), List.of(new BlockEntity("block", "file", 0, 4, assetId, null)));
    }
}
