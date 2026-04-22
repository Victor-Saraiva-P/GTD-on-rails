package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
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
class ContextServiceTests {

    @Mock
    private ContextRepository contextRepository;

    @Mock
    private ContextMapper contextMapper;

    private final ContextNameNormalizer contextNameNormalizer = new ContextNameNormalizer();

    @Captor
    private ArgumentCaptor<Context> contextCaptor;

    private ContextService contextService;

    @BeforeEach
    void setUp() {
        contextService = new ContextService(contextRepository, contextMapper, contextNameNormalizer);
    }

    // listContexts
    @Test
    void listContextsReturnsMappedContexts() {
        Context home = new Context("home");
        Context street = new Context("street");
        ContextResponseDto homeResponse = new ContextResponseDto(UUID.randomUUID(), "home");
        ContextResponseDto streetResponse = new ContextResponseDto(UUID.randomUUID(), "street");

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
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "home");

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

    // createContext
    @Test
    void createContextSavesContext() {
        ContextResponseDto expectedResponse = new ContextResponseDto(UUID.randomUUID(), "home");

        when(contextRepository.save(any(Context.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextMapper.toResponse(any(Context.class))).thenReturn(expectedResponse);

        ContextResponseDto response = contextService.createContext(new CreateContextRequestDto("home"));

        verify(contextRepository).save(contextCaptor.capture());
        assertEquals("home", contextCaptor.getValue().getName());
        assertEquals(expectedResponse, response);
    }

    @Test
    void createContextNormalizesNameBeforeSaving() {
        ContextResponseDto expectedResponse = new ContextResponseDto(UUID.randomUUID(), "home office");

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
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "office");

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
        ContextResponseDto expectedResponse = new ContextResponseDto(contextId, "office room");

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
}
