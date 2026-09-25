package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Tag("unit")
class DomainChangeEventHubTests {

    @Test
    void subscribesAndPublishesDomainChange() {
        DomainChangeEventHub hub = new DomainChangeEventHub();
        SseEmitter emitter = hub.subscribe();

        assertNotNull(emitter);
        assertDoesNotThrow(() -> hub.publish(change()));

        emitter.complete();
    }

    private SyncRemoteChange change() {
        return new SyncRemoteChange(
            5L,
            "items",
            "00000000-0000-0000-0000-000000000001",
            3L,
            "UPSERT",
            "{}",
            null,
            null,
            null
        );
    }
}
