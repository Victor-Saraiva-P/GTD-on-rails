package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

@Tag("unit")
class CacheConfigurationTests {

    @Test
    void cacheManagerProvidesConfiguredCaches() {
        CacheConfiguration configuration = new CacheConfiguration();
        CacheManager cacheManager = configuration.cacheManager();

        assertNotNull(cacheManager);
        assertCachePresent(cacheManager, CacheNames.INBOX);
        assertCachePresent(cacheManager, CacheNames.NEXT_ACTIONS);
        assertCachePresent(cacheManager, CacheNames.PROJECTS);
        assertCachePresent(cacheManager, CacheNames.CONTEXTS);
        assertCachePresent(cacheManager, CacheNames.CALENDAR);
    }

    private void assertCachePresent(CacheManager cacheManager, String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        assertNotNull(cache, "Expected cache " + cacheName + " to be present");
        assertTrue(cacheManager.getCacheNames().contains(cacheName));
    }
}
