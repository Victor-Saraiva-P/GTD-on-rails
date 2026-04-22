package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.item.CreateItemRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.item.UpdateItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ContextRepository contextRepository;
    private final ItemMapper itemMapper;
    private final ItemTextNormalizer itemTextNormalizer;

    public ItemService(
        ItemRepository itemRepository,
        ContextRepository contextRepository,
        ItemMapper itemMapper,
        ItemTextNormalizer itemTextNormalizer
    ) {
        this.itemRepository = itemRepository;
        this.contextRepository = contextRepository;
        this.itemMapper = itemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
    }

    @Transactional(readOnly = true)
    public ItemResponseDto getItem(UUID id) {
        return itemMapper.toResponse(findItem(id));
    }

    @Transactional
    public ItemResponseDto createItem(CreateItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        String normalizedBodyValue = itemTextNormalizer.normalizeBody(request.body());
        Body body = normalizedBodyValue == null ? null : new Body(normalizedBodyValue);
        Item item = new Item(title, body);
        item.replaceContexts(findContextsOrThrow(request.contextIds()));
        return itemMapper.toResponse(itemRepository.save(item));
    }

    @Transactional
    public ItemResponseDto updateItem(UUID id, UpdateItemRequestDto request) {
        Item item = findItem(id);
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        String normalizedBodyValue = itemTextNormalizer.normalizeBody(request.body());
        Body body = normalizedBodyValue == null ? null : new Body(normalizedBodyValue);

        item.setTitle(title);
        item.setBody(body);

        if (request.contextIds() != null) {
            item.replaceContexts(findContextsOrThrow(request.contextIds()));
        }

        return itemMapper.toResponse(itemRepository.save(item));
    }

    @Transactional
    public void deleteItem(UUID id) {
        Item item = findItem(id);
        item.softDelete();
        itemRepository.save(item);
    }

    private Item findItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)

            .orElseThrow(() -> new ItemNotFoundException("item not found"));
    }

    private Set<Context> findContextsOrThrow(List<UUID> contextIds) {
        if (contextIds == null || contextIds.isEmpty()) {
            return Set.of();
        }

        Set<UUID> uniqueContextIds = new HashSet<>(contextIds);
        List<Context> contexts = contextRepository.findAllByIdInAndDeletedAtIsNull(uniqueContextIds);

        if (contexts.size() != uniqueContextIds.size()) {
            throw new ContextNotFoundException("context not found");
        }

        return new HashSet<>(contexts);
    }
}
