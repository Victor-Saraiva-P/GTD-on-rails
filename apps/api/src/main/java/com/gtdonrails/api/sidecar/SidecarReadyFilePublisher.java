package com.gtdonrails.api.sidecar;

import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class SidecarReadyFilePublisher implements ApplicationListener<ApplicationReadyEvent> {

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
     * Publishes the selected HTTP port after startup runners have completed.
     *
     * <p>Example: {@code publisher.onApplicationEvent(event)}.</p>
     */
    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (readyFilePath.isBlank()) {
            return;
        }

        ServletWebServerApplicationContext context = (ServletWebServerApplicationContext) event.getApplicationContext();
        readyFileWriter.write(Path.of(readyFilePath), context.getWebServer().getPort());
    }
}
