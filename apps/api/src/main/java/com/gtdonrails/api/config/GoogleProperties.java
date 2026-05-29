package com.gtdonrails.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "gtd.google")
public class GoogleProperties {
    private String clientId;
    private String clientSecret;
}
