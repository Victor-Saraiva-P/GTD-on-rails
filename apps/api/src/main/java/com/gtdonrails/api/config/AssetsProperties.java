package com.gtdonrails.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "gtd.assets")
public class AssetsProperties {

    private String localDirectory = "gtd-assets";
    private String publicBasePath = "/assets";

}
