package com.gtdonrails.api.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@EnableConfigurationProperties({AssetsProperties.class, CleanupProperties.class, FileSyncProperties.class})
public class AssetsConfig {
}
