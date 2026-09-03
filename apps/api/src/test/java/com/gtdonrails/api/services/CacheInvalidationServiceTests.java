package com.gtdonrails.api.services;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import com.gtdonrails.api.config.CacheNames;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class CacheInvalidationServiceTests {

    @Mock
    private CacheManager cacheManager;

    @Mock
    private Cache inboxCache;

    @Mock
    private Cache nextActionsCache;

    @Mock
    private Cache projectsCache;

    @Mock
    private Cache contextsCache;

    @Mock
    private Cache calendarCache;

    private CacheInvalidationService cacheInvalidationService;

    @BeforeEach
    void setUp() {
        cacheInvalidationService = new CacheInvalidationService(cacheManager);
    }

    @Test
    void evictAllClearsEveryConfiguredCache() {
        when(cacheManager.getCacheNames()).thenReturn(CacheNames.ALL);
        when(cacheManager.getCache(CacheNames.INBOX)).thenReturn(inboxCache);
        when(cacheManager.getCache(CacheNames.NEXT_ACTIONS)).thenReturn(nextActionsCache);
        when(cacheManager.getCache(CacheNames.PROJECTS)).thenReturn(projectsCache);
        when(cacheManager.getCache(CacheNames.CONTEXTS)).thenReturn(contextsCache);
        when(cacheManager.getCache(CacheNames.CALENDAR)).thenReturn(calendarCache);

        cacheInvalidationService.evictAll();

        verify(inboxCache).clear();
        verify(nextActionsCache).clear();
        verify(projectsCache).clear();
        verify(contextsCache).clear();
        verify(calendarCache).clear();
    }

    @Test
    void evictItemMutationClearsRelatedCaches() {
        when(cacheManager.getCache(CacheNames.INBOX)).thenReturn(inboxCache);
        when(cacheManager.getCache(CacheNames.NEXT_ACTIONS)).thenReturn(nextActionsCache);
        when(cacheManager.getCache(CacheNames.PROJECTS)).thenReturn(projectsCache);
        when(cacheManager.getCache(CacheNames.CALENDAR)).thenReturn(calendarCache);
        when(cacheManager.getCache(CacheNames.CONTEXTS)).thenReturn(contextsCache);

        cacheInvalidationService.evictItemMutation();

        verify(inboxCache).clear();
        verify(nextActionsCache).clear();
        verify(projectsCache).clear();
        verify(calendarCache).clear();
        verify(contextsCache).clear();
    }

    @Test
    void evictContextMutationClearsContextAndNextActionCaches() {
        when(cacheManager.getCache(CacheNames.CONTEXTS)).thenReturn(contextsCache);
        when(cacheManager.getCache(CacheNames.NEXT_ACTIONS)).thenReturn(nextActionsCache);

        cacheInvalidationService.evictContextMutation();

        verify(contextsCache).clear();
        verify(nextActionsCache).clear();
    }
}
