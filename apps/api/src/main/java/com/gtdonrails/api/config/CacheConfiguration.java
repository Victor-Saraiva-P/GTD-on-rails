package com.gtdonrails.api.config;

import java.time.Duration;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures Spring Cache backed by Caffeine with 5-minute TTL.
 */
@Configuration
@EnableCaching
public class CacheConfiguration {

    private static final Duration DEFAULT_TTL = Duration.ofMinutes(5);
    private static final long MAX_CACHE_SIZE = 500L;

    /**
     * Builds the Caffeine-backed CacheManager for domain query caches.
     *
     * @return initialized CacheManager
     * @example CacheManager manager = cacheConfiguration.cacheManager();
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(caffeineSpec());
        cacheManager.setCacheNames(CacheNames.ALL);
        return cacheManager;
    }

    private Caffeine<Object, Object> caffeineSpec() {
        return Caffeine.newBuilder()
            .expireAfterWrite(DEFAULT_TTL)
            .maximumSize(MAX_CACHE_SIZE);
    }
}
