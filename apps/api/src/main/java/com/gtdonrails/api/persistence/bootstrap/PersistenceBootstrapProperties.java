package com.gtdonrails.api.persistence.bootstrap;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Setter
@Getter
@ConfigurationProperties(prefix = "gtd.persistence.bootstrap")
public class PersistenceBootstrapProperties {

    private boolean enabled = true;
    private String repositoryUrl;
    private String branch;
    private String cloneDirectory = "gtd-persistence";

}
