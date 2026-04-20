package com.gtdonrails.api.services;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.CreateInboxItemRequestDto;
import com.gtdonrails.api.dtos.InboxItemResponseDto;
import com.gtdonrails.api.dtos.UpdateInboxItemRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.mappers.InboxItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
        try {
            Item item = new Item(
                new Title(itemTextNormalizer.normalizeTitle(request.title())),
                createBody(itemTextNormalizer.normalizeBody(request.body())));
            return inboxItemMapper.toResponse(itemRepository.save(item));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }

    @Transactional
    public InboxItemResponseDto updateStuff(UUID id, UpdateInboxItemRequestDto request) {
        Item item = findInboxStuff(id);

        try {
            item.setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
            item.setBody(createBody(itemTextNormalizer.normalizeBody(request.body())));
            return inboxItemMapper.toResponse(itemRepository.save(item));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }

    @Transactional
    public void deleteStuff(UUID id) {
        Item item = findInboxStuff(id);
        item.softDelete();
        itemRepository.save(item);
    }

    private Item findInboxStuff(UUID id) {
        return itemRepository.findByIdAndStatusAndDeletedAtIsNull(id, ItemStatus.STUFF)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "inbox item not found"));
    }

    private Body createBody(String normalizedBody) {
        return normalizedBody == null ? null : new Body(normalizedBody);
    }
}
