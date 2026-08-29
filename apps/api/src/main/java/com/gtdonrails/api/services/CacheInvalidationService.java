package com.gtdonrails.api.services;

import java.util.Collection;
import java.util.List;

import com.gtdonrails.api.config.CacheNames;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

/**
 * Coordinates explicit cache eviction across GTD domain aggregates.
 */
@Service
public class CacheInvalidationService {

    private final CacheManager cacheManager;

    public CacheInvalidationService(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * Evicts all entries across all active domain caches.
     *
     * @example cacheInvalidationService.evictAll();
     */
    public void evictAll() {
        Collection<String> names = cacheManager.getCacheNames();
        if (names == null) return;
        names.forEach(this::evictCacheByName);
    }

    /**
     * Evicts caches affected by item lifecycle transitions and modifications.
     *
     * @example cacheInvalidationService.evictItemMutation();
     */
    public void evictItemMutation() {
        evictCaches(List.of(
            CacheNames.INBOX,
            CacheNames.NEXT_ACTIONS,
            CacheNames.PROJECTS,
            CacheNames.CALENDAR
        ));
    }

    /**
     * Evicts caches affected by context modifications.
     *
     * @example cacheInvalidationService.evictContextMutation();
     */
    public void evictContextMutation() {
        evictCaches(List.of(
            CacheNames.CONTEXTS,
            CacheNames.NEXT_ACTIONS
        ));
    }

    /**
     * Evicts caches affected by project modifications.
     *
     * @example cacheInvalidationService.evictProjectMutation();
     */
    public void evictProjectMutation() {
        evictCaches(List.of(
            CacheNames.PROJECTS,
            CacheNames.NEXT_ACTIONS
        ));
    }

    /**
     * Evicts caches affected by calendar modifications.
     *
     * @example cacheInvalidationService.evictCalendarMutation();
     */
    public void evictCalendarMutation() {
        evictCacheByName(CacheNames.CALENDAR);
    }

    /**
     * Evicts a single named cache region.
     *
     * @param cacheName the name of the cache to evict
     * @example cacheInvalidationService.evictCacheByName(CacheNames.INBOX);
     */
    public void evictCacheByName(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }

    private void evictCaches(List<String> names) {
        names.forEach(this::evictCacheByName);
    }
}
