package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import com.gtdonrails.api.entities.ItemAsset;
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
    private DataSyncService dataSyncService;

    private ItemAssetService itemAssetService;

    @BeforeEach
    void setUp() {
        itemAssetService = new ItemAssetService(
            itemRepository,
            itemAssetRepository,
            assetStorageService,
            dataSyncService,
            new AfterCommitExecutor());
    }

    @Test
    void storeLocalItemAssetCopiesFileAndRequestsDataSync() {
        UUID itemId = UUID.randomUUID();
        Path sourcePath = Path.of("/home/victor/Downloads/report.pdf");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(new Item(new Title("Capture idea"), null)));
        when(assetStorageService.itemAssetFileName(sourcePath.getFileName().toString())).thenReturn("report.pdf");
        when(assetStorageService.mediaType("report.pdf")).thenReturn(org.springframework.http.MediaType.APPLICATION_PDF);
        when(assetStorageService.publicUrl(any(String.class))).thenReturn("/assets/items/id/asset/report.pdf");

        ItemAssetResponseDto response = itemAssetService.storeLocalItemAsset(itemId, new CopyLocalItemAssetRequestDto(sourcePath.toString()));

        assertEquals("report.pdf", response.fileName());
        assertEquals("application/pdf", response.contentType());
        verify(assetStorageService).copyLocalItemAsset(any(String.class), eq(sourcePath));
        verify(itemAssetRepository).save(any());
        verify(dataSyncService).requestSync("local item asset copied");
    }

    @Test
    void reconcileBodyAssetReferencesRejectsAssetOwnedByOtherItem() {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        when(itemAssetRepository.findByIdAndItemId(assetId, itemId)).thenReturn(Optional.empty());

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> itemAssetService.reconcileBodyAssetReferences(itemId, bodyWithBlockEntity(assetId.toString())));

        assertEquals(
            "body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'",
            exception.getMessage());
    }

    @Test
    void reconcileBodyAssetReferencesSoftDeletesUnreferencedAssets() {
        UUID itemId = UUID.randomUUID();
        ItemAsset keptAsset = itemAsset("kept.png");
        ItemAsset removedAsset = itemAsset("removed.png");

        when(itemAssetRepository.findByIdAndItemId(keptAsset.getId(), itemId)).thenReturn(Optional.of(keptAsset));
        when(itemAssetRepository.findAllByItemIdAndDeletedAtIsNull(itemId)).thenReturn(List.of(keptAsset, removedAsset));

        itemAssetService.reconcileBodyAssetReferences(itemId, bodyWithBlockEntity(keptAsset.getId().toString()));

        assertFalse(keptAsset.isDeleted());
        assertTrue(removedAsset.isDeleted());
        verify(itemAssetRepository).save(removedAsset);
    }

    @Test
    void reconcileBodyAssetReferencesRestoresReferencedAssets() {
        UUID itemId = UUID.randomUUID();
        ItemAsset asset = itemAsset("restored.png");
        asset.softDelete();

        when(itemAssetRepository.findByIdAndItemId(asset.getId(), itemId)).thenReturn(Optional.of(asset));
        when(itemAssetRepository.findAllByItemIdAndDeletedAtIsNull(itemId)).thenReturn(List.of());

        itemAssetService.reconcileBodyAssetReferences(itemId, bodyWithBlockEntity(asset.getId().toString()));

        assertFalse(asset.isDeleted());
        verify(itemAssetRepository).save(asset);
    }

    @Test
    void softDeleteActiveItemAssetsSoftDeletesEveryActiveAsset() {
        UUID itemId = UUID.randomUUID();
        ItemAsset firstAsset = itemAsset("first.png");
        ItemAsset secondAsset = itemAsset("second.png");

        when(itemAssetRepository.findAllByItemIdAndDeletedAtIsNull(itemId)).thenReturn(List.of(firstAsset, secondAsset));

        itemAssetService.softDeleteActiveItemAssets(itemId);

        assertTrue(firstAsset.isDeleted());
        assertTrue(secondAsset.isDeleted());
        verify(itemAssetRepository).save(firstAsset);
        verify(itemAssetRepository).save(secondAsset);
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody("file", List.of(), List.of(), List.of(new BlockEntity("block", "file", 0, 4, assetId, null)));
    }

    private ItemAsset itemAsset(String fileName) {
        return new ItemAsset(new Item(new Title("Capture idea"), null), fileName, fileName, "image/png", 10);
    }
}
