package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import java.time.LocalDate;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MobileControllerTests {

    @TempDir
    Path tempDirectory;

    @Test
    void bootstrapReturnsCanonicalMobileModel() {
        MobileController controller = controller();

        MobileBootstrap bootstrap = controller.bootstrap(LocalDate.parse("2026-09-29"));

        assertEquals(0, bootstrap.cursor());
        assertEquals(0, bootstrap.nextActions().size());
        assertEquals("2026-09-29", bootstrap.calendarLocalDate());
    }

    @Test
    void captureCreatesStuffThroughMobileEndpointContract() {
        MobileController controller = controller();

        MobileCaptureResponse response = controller.capture(new MobileCaptureRequest("Call clinic"));

        assertEquals(1, response.revision());
        assertEquals(1, response.cursor());
    }

    private MobileController controller() {
        SyncObjectStore store = new SyncObjectStore(tempDirectory.resolve("canonical.db"));
        return new MobileController(new MobileService(store, new ObjectMapper()));
    }
}
