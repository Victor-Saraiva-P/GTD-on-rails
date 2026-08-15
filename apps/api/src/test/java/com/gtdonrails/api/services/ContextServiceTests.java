package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Duration;
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
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ContextServiceTests {

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private NextActionRepository nextActionRepository;

    @Mock
    private ContextMapper contextMapper;

    @Mock
    private ItemMapper itemMapper;

    @Mock
    private ContextIconAssetService contextIconAssetService;

    @Captor
    private ArgumentCaptor<Context> contextCaptor;

    private ContextService contextService;

    @BeforeEach
    void setUp() {
        contextService = new ContextService(
            contextRepository,
            nextActionRepository,
            contextMapper,
            itemMapper,
            new ContextNameNormalizer(),
            contextIconAssetService);
    }

    @Test
    void listContextsReturnsMappedContexts() {
        Context home = new Context("home");
        ContextResponseDto homeResponse = new ContextResponseDto(UUID.randomUUID(), "home", null);

        when(contextRepository.findAllByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of(home));
        when(contextMapper.toResponse(home)).thenReturn(homeResponse);

        List<ContextResponseDto> response = contextService.listContexts();

        assertEquals(List.of(homeResponse), response);
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
    void listContextItemsReturnsItemsFromNextActions() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        NextAction nextAction = nextAction("Buy cable", context);
        ContextItemResponseDto itemResponse = contextItemResponse("Buy cable");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(nextActionRepository.findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(contextId))
            .thenReturn(List.of(nextAction));
        when(itemMapper.toContextItemResponse(nextAction.getItem())).thenReturn(itemResponse);

        List<ContextItemResponseDto> response = contextService.listContextItems(contextId, null);

        assertEquals(List.of(itemResponse), response);
    }

    @Test
    void listContextItemsAppliesLimit() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        NextAction nextAction = nextAction("Buy cable", context);
        ContextItemResponseDto itemResponse = contextItemResponse("Buy cable");

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));
        when(nextActionRepository.findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(
            eq(contextId),
            eq(PageRequest.of(0, 1))
        )).thenReturn(new PageImpl<>(List.of(nextAction)));
        when(itemMapper.toContextItemResponse(nextAction.getItem())).thenReturn(itemResponse);

        List<ContextItemResponseDto> response = contextService.listContextItems(contextId, 1);

        assertEquals(List.of(itemResponse), response);
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

        assertEquals(expectedResponse, response);
        assertEquals("office", context.getName());
    }

    @Test
    void deleteContextRemovesRelationFromAllNextActions() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        NextAction firstAction = nextAction("First item", context);
        NextAction secondAction = nextAction("Second item", context);

        when(contextRepository.findByIdAndDeletedAtIsNull(contextId)).thenReturn(Optional.of(context));

        contextService.deleteContext(contextId);

        assertEquals(Set.of(), firstAction.getContexts());
        assertEquals(Set.of(), secondAction.getContexts());
        assertEquals(Set.of(), context.getNextActions());
        assertTrue(context.isDeleted());
        verify(contextIconAssetService).deleteContextIconAsset(context);
    }

    @Test
    void restoreContextClearsDeletedFlag() {
        UUID contextId = UUID.randomUUID();
        Context context = new Context("home");
        context.softDelete();

        when(contextRepository.findById(contextId)).thenReturn(Optional.of(context));

        contextService.restoreContext(contextId);

        assertFalse(context.isDeleted());
        verify(contextRepository).save(contextCaptor.capture());
    }

    private NextAction nextAction(String title, Context context) {
        Item item = new Item(new Title(title), null);
        return item.convertToNextAction(BigDecimal.ONE, Duration.ZERO, Set.of(context));
    }

    private ContextItemResponseDto contextItemResponse(String title) {
        return new ContextItemResponseDto(UUID.randomUUID(), title, "NEXT_ACTION");
    }
}
