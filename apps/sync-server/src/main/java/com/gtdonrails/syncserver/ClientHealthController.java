package com.gtdonrails.syncserver;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ClientHealthController {

    private final String revision;

    public ClientHealthController(
        @Value("$" + "{GTD_BUILD_REVISION:development}") String revision
    ) {
        this.revision = normalizeRevision(revision);
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
            "status", "UP",
            "version", ClientVersion.current(),
            "revision", revision
        );
    }

    private String normalizeRevision(String value) {
        return value == null || value.isBlank() ? "development" : value.trim().toLowerCase();
    }
}
