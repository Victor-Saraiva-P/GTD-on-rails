package com.gtdonrails.api.sidecar;

import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.server.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class SidecarReadyFilePublisher implements ApplicationListener<WebServerInitializedEvent> {

    private final String readyFilePath;
    private final SidecarReadyFileWriter readyFileWriter;

    public SidecarReadyFilePublisher(
        @Value("${gtd.sidecar.ready-file:}") String readyFilePath,
        SidecarReadyFileWriter readyFileWriter
    ) {
        this.readyFilePath = readyFilePath.trim();
        this.readyFileWriter = readyFileWriter;
    }

    /**
     * Publishes the selected HTTP port once Spring's embedded web server binds.
     *
     * <p>Example: {@code publisher.onApplicationEvent(event)}.</p>
     */
    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        if (readyFilePath.isBlank()) {
            return;
        }

        readyFileWriter.write(Path.of(readyFilePath), event.getWebServer().getPort());
    }
}
