package com.gtdonrails.api.controllers;

import java.util.List;

import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.services.InboxService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/inbox")
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    /**
     * Handles inbox requests for items still classified as stuff.
     *
     * <p>Example: {@code GET /inbox}.</p>
     */
    @GetMapping
    public List<ItemResponseDto> listStuff() {
        return inboxService.listStuff();
    }
}
