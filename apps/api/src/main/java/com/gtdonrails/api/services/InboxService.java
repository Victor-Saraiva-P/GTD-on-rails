package com.gtdonrails.api.services;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.dtos.inbox.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.inbox.InboxItemResponseDto;
import com.gtdonrails.api.dtos.inbox.UpdateInboxItemRequestDto;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.mappers.InboxItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InboxService {

    private final ItemRepository itemRepository;
    private final ContextRepository contextRepository;
    private final InboxItemMapper inboxItemMapper;
    private final ItemTextNormalizer itemTextNormalizer;

    public InboxService(
        ItemRepository itemRepository,
        ContextRepository contextRepository,
        InboxItemMapper inboxItemMapper,
        ItemTextNormalizer itemTextNormalizer
    ) {
        this.itemRepository = itemRepository;
        this.contextRepository = contextRepository;
        this.inboxItemMapper = inboxItemMapper;
        this.itemTextNormalizer = itemTextNormalizer;
    }

    @Transactional(readOnly = true)
    public List<InboxItemResponseDto> listStuff() {
        return itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF)
            .stream()
            .map(inboxItemMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public InboxItemResponseDto getStuff(UUID id) {
        return inboxItemMapper.toResponse(findInboxStuff(id));
    }

    @Transactional
    public InboxItemResponseDto createStuff(CreateInboxItemRequestDto request) {
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        String normalizedBodyValue = itemTextNormalizer.normalizeBody(request.body());
        Body body = normalizedBodyValue == null ? null : new Body(normalizedBodyValue);
        Item item = new Item(
            title,
            body);
        item.replaceContexts(findContextsOrThrow(request.contextIds()));
        return inboxItemMapper.toResponse(itemRepository.save(item));
    }

    @Transactional
    public InboxItemResponseDto updateStuff(UUID id, UpdateInboxItemRequestDto request) {
        Item item = findInboxStuff(id);
        Title title = new Title(itemTextNormalizer.normalizeTitle(request.title()));
        String normalizedBodyValue = itemTextNormalizer.normalizeBody(request.body());
        Body body = normalizedBodyValue == null ? null : new Body(normalizedBodyValue);

        item.setTitle(title);
        item.setBody(body);
        item.replaceContexts(findContextsOrThrow(request.contextIds()));
        return inboxItemMapper.toResponse(itemRepository.save(item));
    }

    @Transactional
    public void deleteStuff(UUID id) {
        Item item = findInboxStuff(id);
        item.softDelete();
        itemRepository.save(item);
    }

    private Item findInboxStuff(UUID id) {
        return itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.STUFF)
            .orElseThrow(() -> new InboxItemNotFoundException("item not found"));
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
