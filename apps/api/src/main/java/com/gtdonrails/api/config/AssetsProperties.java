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
    private Rclone rclone = new Rclone();
    private Sync sync = new Sync();

    @Getter
    @Setter
    public static class Rclone {

        private boolean enabled = false;
        private String command = "rclone";
        private String remote;

    }

    @Getter
    @Setter
    public static class Sync {

        private long intervalMs = 300_000;
        private String stateDirectory = ".gtd-assets-sync";
        private String baselineMarker = "bisync-ready";
        private boolean force = true;

    }

}
