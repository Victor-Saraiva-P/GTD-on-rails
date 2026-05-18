package com.gtdonrails.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "gtd.cleanup")
public class CleanupProperties {

    private boolean enabled = true;
    private long retentionDays = 30;
}
