package com.gtdonrails.api.services;

import java.util.List;

import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.repositories.ItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InboxService {

    private final ItemRepository itemRepository;
    private final ItemMapper itemMapper;

    public InboxService(
        ItemRepository itemRepository,
        ItemMapper itemMapper
    ) {
        this.itemRepository = itemRepository;
        this.itemMapper = itemMapper;
    }

    /**
     * Lists inbox items that are still in the GTD stuff state.
     *
     * <p>Example: {@code inboxService.listStuff()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ItemResponseDto> listStuff() {
        return itemRepository.findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus.STUFF)
            .stream()
            .map(itemMapper::toResponse)
            .toList();
    }
}
