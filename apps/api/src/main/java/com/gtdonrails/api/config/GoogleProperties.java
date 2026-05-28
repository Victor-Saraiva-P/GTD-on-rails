package com.gtdonrails.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.PropertySource;

@Getter
@Setter
@ConfigurationProperties(prefix = "gtd.google")
@PropertySource(value = "file:${gtd.persistence.bootstrap.clone-directory}/config/google.properties", ignoreResourceNotFound = true)
public class GoogleProperties {
    private String clientId;
    private String clientSecret;
}
