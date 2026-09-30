package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MobilePageControllerTests {

    @Test
    void mobileDirectoryForwardsToPackagedIndex() {
        assertEquals("forward:/mobile/index.html", new MobilePageController().mobile());
    }
}
