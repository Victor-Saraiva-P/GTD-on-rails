package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.apache.catalina.connector.Connector;
import org.junit.jupiter.api.Test;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;

class GoogleCalendarCallbackConnectorConfigurationTests {

    @Test
    void callbackConnectorUsesLoopbackAndItsConfiguredPort() {
        GoogleCalendarCallbackConnectorConfiguration configuration =
            new GoogleCalendarCallbackConnectorConfiguration("127.0.0.1", 7676);
        TomcatServletWebServerFactory serverFactory = new TomcatServletWebServerFactory();

        configuration.googleCalendarCallbackConnector().customize(serverFactory);

        Connector connector = serverFactory.getAdditionalConnectors().iterator().next();
        assertEquals(7676, connector.getPort());
        assertEquals("/127.0.0.1", connector.getProperty("address").toString());
        assertEquals("http", connector.getScheme());
        assertFalse(connector.getSecure());
    }
}
