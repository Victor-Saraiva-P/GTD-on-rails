package com.gtdonrails.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Primary;

@Getter
@Setter
@Primary
@ConfigurationProperties(prefix = "gtd.sync")
public class DataSyncProperties {

    private Rclone rclone = new Rclone();
    private long intervalMs = 300_000;
    private String syncCheckFilename = "gtd-on-rails-sync-check";
    private boolean force = true;

    @Getter
    @Setter
    public static class Rclone {

        private boolean enabled = false;
        private String command = "rclone";
        private String remote;

    }

}
