package com.gtdonrails.syncserver;

import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.tomcat.TomcatWebServerFactory;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "gtd.sync-server.google-calendar.callback-listener.enabled", havingValue = "true")
public class GoogleCalendarCallbackConnectorConfiguration {

    private final String bindAddress;
    private final int port;

    public GoogleCalendarCallbackConnectorConfiguration(
        @Value("${gtd.sync-server.google-calendar.callback-listener.bind-address:127.0.0.1}") String bindAddress,
        @Value("${gtd.sync-server.google-calendar.callback-listener.port:7676}") int port
    ) {
        this.bindAddress = bindAddress;
        this.port = port;
    }

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> googleCalendarCallbackConnector() {
        return factory -> factory.addAdditionalConnectors(callbackConnector());
    }

    private Connector callbackConnector() {
        Connector connector = new Connector(TomcatWebServerFactory.DEFAULT_PROTOCOL);
        connector.setPort(port);
        connector.setProperty("address", bindAddress);
        connector.setScheme("http");
        connector.setSecure(false);
        return connector;
    }
}
