package com.gtdonrails.api.controllers;

import java.time.Clock;
import java.time.Instant;

import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.services.CacheInvalidationService;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile({"test", "dev"})
@RequestMapping("/test")
public class TestResetController {

    private final ContextRepository contextRepository;
    private final ItemRepository itemRepository;
    private final ProjectRepository projectRepository;
    private final ProjectItemRepository projectItemRepository;
    private final CacheInvalidationService cacheInvalidationService;
    private final Clock clock;

    public TestResetController(
        ContextRepository contextRepository,
        ItemRepository itemRepository,
        ProjectRepository projectRepository,
        ProjectItemRepository projectItemRepository,
        CacheInvalidationService cacheInvalidationService,
        Clock clock
    ) {
        this.contextRepository = contextRepository;
        this.itemRepository = itemRepository;
        this.projectRepository = projectRepository;
        this.projectItemRepository = projectItemRepository;
        this.cacheInvalidationService = cacheInvalidationService;
        this.clock = clock;
    }

    /**
     * Clears mutable test data so integration tests can start from a known state.
     *
     * <p>Example: {@code POST /test/reset}.</p>
     */
    @PostMapping("/reset")
    @Transactional
    public ResponseEntity<Void> reset() {
        projectItemRepository.deleteAll();
        projectRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
        cacheInvalidationService.evictAll();
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns the current UTC time the backend is using.
     *
     * <p>Example: {@code GET /test/clock}.</p>
     */
    @GetMapping("/clock")
    public ResponseEntity<ClockResponse> getClock() {
        return ResponseEntity.ok(new ClockResponse(Instant.now(clock).toString()));
    }

    public record ClockResponse(String utcTime) {}
}
