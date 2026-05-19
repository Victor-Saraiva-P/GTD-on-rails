package com.gtdonrails.api.sidecar;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Component;

@Component
public class SidecarReadyFileWriter {

    private final Clock clock;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SidecarReadyFileWriter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Writes an atomic backend readiness marker for the Tauri sidecar host.
     *
     * <p>Example: {@code writer.write(Path.of("ready.json"), 43127)}.</p>
     */
    public void write(Path readyFile, int port) {
        validatePort(port);
        createParentDirectories(readyFile);
        writeAtomically(readyFile, payload(port));
    }

    private SidecarReadyPayload payload(int port) {
        return new SidecarReadyPayload(
            "127.0.0.1",
            port,
            "http://127.0.0.1:" + port,
            clock.instant().toString()
        );
    }

    private void validatePort(int port) {
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException(
                "sidecar port value '%s' is invalid; expected 1..65535".formatted(port)
            );
        }
    }

    private void createParentDirectories(Path readyFile) {
        try {
            Path parent = readyFile.toAbsolutePath().getParent();
            if (parent != null) Files.createDirectories(parent);
        } catch (IOException error) {
            throw readyFileException(readyFile, error);
        }
    }

    private void writeAtomically(Path readyFile, SidecarReadyPayload payload) {
        Path temporaryFile = readyFile.resolveSibling(readyFile.getFileName() + ".tmp");
        try {
            objectMapper.writeValue(temporaryFile.toFile(), payload);
            Files.move(temporaryFile, readyFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException error) {
            throw readyFileException(readyFile, error);
        }
    }

    private IllegalStateException readyFileException(Path readyFile, IOException error) {
        return new IllegalStateException(
            "sidecar ready file path '%s' is invalid; expected writable JSON file".formatted(readyFile),
            error
        );
    }
}
