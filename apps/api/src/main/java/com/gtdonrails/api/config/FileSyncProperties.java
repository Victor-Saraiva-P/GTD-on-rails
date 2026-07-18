package com.gtdonrails.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Canonical File Sync view of the existing synchronization configuration.
 *
 * <p>Example: {@code fileSyncProperties.getSyncCheckFilename()}.</p>
 */
@ConfigurationProperties(prefix = "gtd.sync")
public class FileSyncProperties extends DataSyncProperties {
}
