package com.gtdonrails.api.controllers;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes maintenance endpoints for cache invalidation.
 */
@RestController
@RequestMapping("/maintenance/cache")
public class MaintenanceCacheController {

    private final CacheInvalidationService cacheInvalidationService;

    public MaintenanceCacheController(CacheInvalidationService cacheInvalidationService) {
        this.cacheInvalidationService = cacheInvalidationService;
    }

    /**
     * Evicts all in-memory domain query caches.
     *
     * @return 204 No Content response
     * @example POST /maintenance/cache/evict
     */
    @PostMapping("/evict")
    public ResponseEntity<Void> evictAllCaches() {
        cacheInvalidationService.evictAll();
        return ResponseEntity.noContent().build();
    }
}
