package com.gtdonrails.api.services;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.InboxItemResponseDto;
import com.gtdonrails.api.dtos.UpdateInboxItemRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.mappers.InboxItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InboxService {

    private final ItemRepository itemRepository;
    private final InboxItemMapper inboxItemMapper;
    private final ItemTextNormalizer itemTextNormalizer;

    public InboxService(
        ItemRepository itemRepository,
        InboxItemMapper inboxItemMapper,
        ItemTextNormalizer itemTextNormalizer
    ) {
        this.itemRepository = itemRepository;
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
}
