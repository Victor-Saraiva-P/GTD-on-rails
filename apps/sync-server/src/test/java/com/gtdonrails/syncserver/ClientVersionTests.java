package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ClientVersionTests {

    @Test
    void semanticVersionComparisonIsNumeric() {
        assertTrue(ClientVersion.newer("2.10.0", "2.9.9"));
        assertFalse(ClientVersion.newer("2.5.0", "2.5.0"));
        assertFalse(ClientVersion.newer("2.4.9", "2.5.0"));
    }

    @Test
    void releaseTagPrefixesAreAccepted() {
        assertTrue(ClientVersion.newer("v2.5.1", "2.5.0"));
        assertTrue(ClientVersion.newer("app-v2.5.1", "2.5.0"));
    }

    @Test
    void invalidVersionIsRejected() {
        assertThrows(
            IllegalArgumentException.class,
            () -> ClientVersion.newer("next", "2.5.0")
        );
    }
}
