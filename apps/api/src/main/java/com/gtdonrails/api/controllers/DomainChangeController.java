package com.gtdonrails.api.controllers;

import com.gtdonrails.api.sync.DomainChangeEventHub;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/events")
public class DomainChangeController {

    private final DomainChangeEventHub eventHub;

    public DomainChangeController(DomainChangeEventHub eventHub) {
        this.eventHub = eventHub;
    }

    @GetMapping(path = "/domain", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter domainChanges() {
        return eventHub.subscribe();
    }
}
