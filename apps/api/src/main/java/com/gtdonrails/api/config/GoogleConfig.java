package com.gtdonrails.api.config;

import java.time.Duration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
@EnableConfigurationProperties(GoogleProperties.class)
public class GoogleConfig {

    private static final Duration GOOGLE_TOKEN_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration GOOGLE_TOKEN_READ_TIMEOUT = Duration.ofSeconds(30);

    @Bean
    public RestTemplate googleTokenRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(GOOGLE_TOKEN_CONNECT_TIMEOUT);
        requestFactory.setReadTimeout(GOOGLE_TOKEN_READ_TIMEOUT);
        return new RestTemplate(requestFactory);
    }
}
