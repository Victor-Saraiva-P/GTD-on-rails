package com.gtdonrails.api.services;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.dtos.context.CreateContextRequestDto;
import com.gtdonrails.api.dtos.context.UpdateContextRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.exceptions.context.ContextAlreadyExistsException;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.normalizers.ContextNameNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContextService {

    private final ContextRepository contextRepository;
    private final ContextMapper contextMapper;
    private final ContextNameNormalizer contextNameNormalizer;

    public ContextService(
        ContextRepository contextRepository,
        ContextMapper contextMapper,
        ContextNameNormalizer contextNameNormalizer
    ) {
        this.contextRepository = contextRepository;
        this.contextMapper = contextMapper;
        this.contextNameNormalizer = contextNameNormalizer;
    }

    @Transactional(readOnly = true)
    public List<ContextResponseDto> listContexts() {
        return contextRepository.findAllByDeletedAtIsNullOrderByNameAsc()
            .stream()
            .map(contextMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public ContextResponseDto getContext(UUID id) {
        return contextMapper.toResponse(findContext(id));
    }

    @Transactional
    public ContextResponseDto createContext(CreateContextRequestDto request) {
        String normalizedName = contextNameNormalizer.normalize(request.name());
        if (contextRepository.existsByName(normalizedName)) {
            throw new ContextAlreadyExistsException("context name already exists");
        }

        Context context = new Context(normalizedName);
        return contextMapper.toResponse(contextRepository.save(context));
    }

    @Transactional
    public ContextResponseDto updateContext(UUID id, UpdateContextRequestDto request) {
        Context context = findContext(id);
        String normalizedName = contextNameNormalizer.normalize(request.name());

        if (contextRepository.existsByNameAndIdNot(normalizedName, id)) {
            throw new ContextAlreadyExistsException("context name already exists");
        }

        context.setName(normalizedName);
        return contextMapper.toResponse(contextRepository.save(context));
    }

    @Transactional
    public void deleteContext(UUID id) {
        Context context = findContext(id);
        context.softDelete();
        contextRepository.save(context);
    }

    private Context findContext(UUID id) {
        return contextRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ContextNotFoundException("context not found"));
    }
}
