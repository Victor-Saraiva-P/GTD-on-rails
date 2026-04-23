package com.gtdonrails.api.persistence.bootstrap;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Setter
@Getter
@ConfigurationProperties(prefix = "gtd.persistence.sync")
public class PersistenceSyncProperties {

    private boolean enabled = true;
    private long intervalMs = 300000;
    private String commitAuthorName = "GTD on Rails";
    private String commitAuthorEmail = "gtdonrails@local";

}
