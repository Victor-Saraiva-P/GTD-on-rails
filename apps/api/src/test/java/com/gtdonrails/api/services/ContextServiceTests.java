package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextItemResponseDto;
import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ContextServiceTests {

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private ContextMapper contextMapper;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private AssetStorageService assetStorageService;

    @Mock
    private AssetSyncService assetSyncService;

    private final ContextNameNormalizer contextNameNormalizer = new ContextNameNormalizer();

    @Captor
    private ArgumentCaptor<Context> contextCaptor;

    private ContextService contextService;

    @BeforeEach
    void setUp() {
        contextService = new ContextService(
            contextRepository,
            itemRepository,
            contextMapper,
            itemMapper,
            contextNameNormalizer,
            assetStorageService,
            assetSyncService
        );
    }

    // listContexts
    @Test
    void listContextsReturnsMappedContexts() {
        Context home = new Context("home");
        Context street = new Context("street");
        ContextResponseDto homeResponse = new ContextResponseDto(UUID.randomUUID(), "home", null);
        ContextResponseDto streetResponse = new ContextResponseDto(UUID.randomUUID(), "street", null);

        when(contextRepository.findAllByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of(home, street));
        when(contextMapper.toResponse(home)).thenReturn(homeResponse);
        when(contextMapper.toResponse(street)).thenReturn(streetResponse);

        List<ContextResponseDto> response = contextService.listContexts();

        assertEquals(List.of(homeResponse, streetResponse), response);
    }

    // getContext
    @Test
    void getContextReturnsMappedContext() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "home", null);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(contextMapper.toResponse(context)).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.getContext(contextId);

        assertEquals(expectedResponse, response);
    }

    @Test
    void getContextThrowsWhenContextDoesNotExist() {
        UUID contextId = UUID.randomUUID();

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.empty());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> contextService.getContext(contextId));

        assertEquals("context not found", exception.getMessage());
    }

    @Test
    void listContextItemsReturnsMappedItemsOrderedByUpdatedAtDesc() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        Item newerItem = new Item(new Title("Newer item"), null);
        Item olderItem = new Item(new Title("Older item"), null);
        ContextItemResponseDto newerResponse = new ContextItemResponseDto(
            UUID.randomUUID(),
            "Newer item",
            "STUFF"
        );
        ContextItemResponseDto olderResponse = new ContextItemResponseDto(
            UUID.randomUUID(),
            "Older item",
            "STUFF"
        );

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(itemRepository.findAllByContexts_IdAndDeletedAtIsNullOrderByUpdatedAtDesc(contextId))
            .thenReturn(List.of(newerItem, olderItem));
        when(itemMapper.toContextItemResponse(newerItem)).thenReturn(newerResponse);
        when(itemMapper.toContextItemResponse(olderItem)).thenReturn(olderResponse);

        List<ContextItemResponseDto> response = contextService.listContextItems(contextId, null);

        assertEquals(List.of(newerResponse, olderResponse), response);
    }

    @Test
    void listContextItemsAppliesLimit() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        Item limitedItem = new Item(new Title("Limited item"), null);
        ContextItemResponseDto limitedResponse = new ContextItemResponseDto(
            UUID.randomUUID(),
            "Limited item",
            "STUFF"
        );

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(itemRepository.findAllByContexts_IdAndDeletedAtIsNullOrderByUpdatedAtDesc(
            eq(contextId),
            eq(PageRequest.of(0, 1))
        )).thenReturn(new PageImpl<>(List.of(limitedItem)));
        when(itemMapper.toContextItemResponse(limitedItem)).thenReturn(limitedResponse);

        List<ContextItemResponseDto> response = contextService.listContextItems(contextId, 1);

        assertEquals(List.of(limitedResponse), response);
    }

    @Test
    void listContextItemsThrowsWhenContextDoesNotExist() {
        UUID contextId = UUID.randomUUID();

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.empty());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> contextService.listContextItems(contextId, 10)
        );

        assertEquals("context not found", exception.getMessage());
    }

    // createContext
    @Test
    void createContextSavesContext() {
        ContextResponseDto expectedResponse = new ContextResponseDto(UUID.randomUUID(), "home", null);

        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.createContext(new CreateContextRequestDto("home"));

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("home", contextCaptor.getValue().getName());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createContextNormalizesNameBeforeSaving() {
        ContextResponseDto expectedResponse = new ContextResponseDto(UUID.randomUUID(), "home office", null);

        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        contextService.createContext(new CreateContextRequestDto(" home\toffice "));

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("home office", contextCaptor.getValue().getName());
    }

    @Test
    void updateContextUpdatesName() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "office", null);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.updateContext(contextId, new UpdateContextRequestDto("office"));

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("office", contextCaptor.getValue().getName());
        assertEquals(expectedResponse, response);
    }

    @Test
    void updateContextNormalizesNameBeforeSaving() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "office room", null);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        contextService.updateContext(contextId, new UpdateContextRequestDto(" office\troom "));

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("office room", contextCaptor.getValue().getName());
    }

    // deleteContext
    @Test
    void deleteContextSoftDeletesContext() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        contextService.deleteContext(contextId);

        verify(contextRepository).save(contextCaptor.capture());
        assertTrue(contextCaptor.getValue().isDeleted());
    }

    @Test
    void deleteContextRemovesRelationFromAllItems() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        Item firstItem = new Item(new Title("First item"), null);
        Item secondItem = new Item(new Title("Second item"), null);
        firstItem.addContext(context);
        secondItem.addContext(context);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        contextService.deleteContext(contextId);

        assertEquals(Set.of(), firstItem.getContexts());
        assertEquals(Set.of(), secondItem.getContexts());
        assertEquals(Set.of(), context.getItems());
    }

    @Test
    void deleteContextDeletesCurrentIconAsset() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        context.setIconAssetPath("contexts/home/icon.png");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        contextService.deleteContext(contextId);

        verify(assetStorageService).deleteAsset("contexts/home/icon.png");
    }

    @Test
    void deleteContextRequestsAssetSyncImmediatelyWhenNoTransactionSynchronizationIsActive() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        contextService.deleteContext(contextId);

        verify(assetSyncService).requestSync("context deleted");
    }

    @Test
    void updateContextIconStoresIconAndUpdatesContext() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "home", "/assets/contexts/home/icon.png");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(assetStorageService.storeContextIcon(contextId, file)).thenReturn("contexts/home/icon.png");
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.updateContextIcon(contextId, file);

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("contexts/home/icon.png", contextCaptor.getValue().getIconAssetPath());
        assertEquals(expectedResponse, response);
        verify(assetSyncService).requestSync("context icon updated");
    }

    @Test
    void updateContextIconDeletesPreviousIconWhenPathChanges() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        context.setIconAssetPath("contexts/home/old-icon.png");
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(assetStorageService.storeContextIcon(contextId, file)).thenReturn("contexts/home/new-icon.png");
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(new ContextResponseDto(contextId, "home", null));

        contextService.updateContextIcon(contextId, file);

        verify(assetStorageService).deleteAsset("contexts/home/old-icon.png");
    }

    @Test
    void updateContextIconDoesNotDeletePreviousIconWhenPathIsUnchanged() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        context.setIconAssetPath("contexts/home/icon.png");
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(assetStorageService.storeContextIcon(contextId, file)).thenReturn("contexts/home/icon.png");
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(new ContextResponseDto(contextId, "home", null));

        contextService.updateContextIcon(contextId, file);

        verify(assetStorageService).storeContextIcon(contextId, file);
        verify(assetStorageService, org.mockito.Mockito.never()).deleteAsset("contexts/home/icon.png");
    }

    @Test
    void updateContextIconThrowsWhenContextDoesNotExist() {
        UUID contextId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3});

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.empty());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> contextService.updateContextIcon(contextId, file)
        );

        assertEquals("context not found", exception.getMessage());
    }

    @Test
    void deleteContextIconDeletesAssetAndClearsPath() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        context.setIconAssetPath("contexts/home/icon.png");
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "home", null);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.deleteContextIcon(contextId);

        verify(assetStorageService).deleteAsset("contexts/home/icon.png");
        verify(contextRepository).save(contextCaptor.capture());
        assertNull(contextCaptor.getValue().getIconAssetPath());
        assertEquals(expectedResponse, response);
        verify(assetSyncService).requestSync("context icon deleted");
    }

    @Test
    void deleteContextIconThrowsWhenContextDoesNotExist() {
        UUID contextId = UUID.randomUUID();

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.empty());

        ContextNotFoundException exception = assertThrows(
            ContextNotFoundException.class,
            () -> contextService.deleteContextIcon(contextId)
        );

        assertEquals("context not found", exception.getMessage());
    }

    @Test
    void requestsAssetSyncOnlyAfterCommitWhenTransactionSynchronizationIsActive() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        TransactionSynchronizationManager.initSynchronization();
        try {
            contextService.deleteContext(contextId);

            verify(assetSyncService, org.mockito.Mockito.never()).requestSync("context deleted");

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCommit();
            }

            verify(assetSyncService).requestSync("context deleted");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
