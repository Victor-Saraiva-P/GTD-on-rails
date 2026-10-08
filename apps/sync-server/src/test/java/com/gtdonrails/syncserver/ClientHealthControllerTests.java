package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.Test;

class ClientHealthControllerTests {

    @Test
    void healthIncludesBuildRevision() {
        String revision = "0123456789abcdef0123456789abcdef01234567";
        ClientHealthController controller = new ClientHealthController(revision);

        Map<String, String> health = controller.health();

        assertEquals(revision, health.get("revision"));
    }
}
