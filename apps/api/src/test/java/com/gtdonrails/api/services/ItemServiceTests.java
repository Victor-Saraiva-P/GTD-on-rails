package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CopyLocalItemAssetRequestDto;
import com.gtdonrails.api.dtos.item.ItemAssetResponseDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.PatchItemBodyRequestDto;
import com.gtdonrails.api.dtos.item.UpdateItemTitleRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ItemServiceTests {

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ItemAssetRepository itemAssetRepository;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private AssetSyncService assetSyncService;

    @Mock
    private PersistenceGitSyncService persistenceGitSyncService;

    @Captor
    private ArgumentCaptor<Item> itemCaptor;

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(
            itemRepository,
            itemAssetRepository,
            itemMapper,
            new ItemTextNormalizer(),
            new ItemBodyNormalizer(),
            assetStorageService,
            assetSyncService,
            persistenceGitSyncService,
            new AfterCommitExecutor());
    }

    @Test
    void updateItemTitleNormalizesAndSavesTitleOnly() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("New title", "Old body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.updateItemTitle(itemId, new UpdateItemTitleRequestDto(" New\ttitle "));

        assertEquals("New title", capturedSavedItem().getTitle().value());
        assertEquals(expectedResponse, response);
        verify(persistenceGitSyncService).requestSync("item title updated", PersistenceChangeType.UPDATE_ITEM);
    }

    @Test
    void patchItemBodyUpdatesOnlyBody() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Old title"), "Old body");
        ItemResponseDto expectedResponse = itemResponse("Old title", "New body");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        stubSavedItemResponse(expectedResponse);

        ItemResponseDto response = itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(bodyValue("New body")));

        Item savedItem = capturedSavedItem();
        assertEquals("Old title", savedItem.getTitle().value());
        assertEquals("New body", savedItem.getBody().text());
        assertEquals(expectedResponse, response);
    }

    @Test
    void patchItemBodyRejectsAssetOwnedByOtherItem() {
        UUID itemId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId))
            .thenReturn(Optional.of(new Item(new Title("Title"), null)));
        when(itemAssetRepository.existsByIdAndItemId(assetId, itemId)).thenReturn(false);

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> itemService.patchItemBody(itemId, new PatchItemBodyRequestDto(bodyWithBlockEntity(assetId.toString()))));

        assertEquals(
            "body.blockEntities.assetId value '" + assetId + "' is invalid; expected asset owned by item '" + itemId + "'",
            exception.getMessage());
    }

    @Test
    void storeLocalItemAssetCopiesFileAndRequestsAssetSync() {
        UUID itemId = UUID.randomUUID();
        Item item = new Item(new Title("Capture idea"), null);
        Path sourcePath = Path.of("/home/victor/Downloads/report.pdf");

        when(itemRepository.findByIdAndDeletedAtIsNull(itemId)).thenReturn(Optional.of(item));
        when(assetStorageService.copyLocalItemAsset(eq(itemId), any(Path.class))).thenReturn("items/id/asset/report.pdf");
        when(assetStorageService.fileName("items/id/asset/report.pdf")).thenReturn("report.pdf");
        when(assetStorageService.mediaType("items/id/asset/report.pdf")).thenReturn(org.springframework.http.MediaType.APPLICATION_PDF);
        when(assetStorageService.publicUrl("items/id/asset/report.pdf")).thenReturn("/assets/items/id/asset/report.pdf");
        when(itemAssetRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ItemAssetResponseDto response = itemService.storeLocalItemAsset(itemId, new CopyLocalItemAssetRequestDto(sourcePath.toString()));

        assertEquals("report.pdf", response.fileName());
        assertEquals("application/pdf", response.contentType());
        verify(assetSyncService).requestSync("local item asset copied");
    }

    private void stubSavedItemResponse(ItemResponseDto response) {
        when(itemRepository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemMapper.toResponse(any(Item.class))).thenReturn(response);
    }

    private Item capturedSavedItem() {
        verify(itemRepository).save(itemCaptor.capture());
        return itemCaptor.getValue();
    }

    private ItemResponseDto itemResponse(String title, String body) {
        return new ItemResponseDto(UUID.randomUUID(), title, bodyValue(body), null, null, "STUFF", Instant.now(), List.of());
    }

    private ItemBody bodyValue(String text) {
        return new ItemBody(text, List.of(), List.of(), List.of());
    }

    private ItemBody bodyWithBlockEntity(String assetId) {
        return new ItemBody("file", List.of(), List.of(), List.of(new BlockEntity("block", "file", 0, 4, assetId, null)));
    }
}
