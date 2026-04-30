package com.gtdonrails.api.controllers;

import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("test")
@RequestMapping("/test")
public class TestResetController {

    private final ContextRepository contextRepository;
    private final ItemRepository itemRepository;

    public TestResetController(ContextRepository contextRepository, ItemRepository itemRepository) {
        this.contextRepository = contextRepository;
        this.itemRepository = itemRepository;
    }

    @PostMapping("/reset")
    @Transactional
    public ResponseEntity<Void> reset() {
        itemRepository.deleteAll();
        contextRepository.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
