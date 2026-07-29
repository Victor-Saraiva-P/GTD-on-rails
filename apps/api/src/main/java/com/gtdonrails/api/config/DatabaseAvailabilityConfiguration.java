package com.gtdonrails.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class DatabaseAvailabilityConfiguration implements WebMvcConfigurer {

    private final DatabaseAvailabilityInterceptor availabilityInterceptor;

    public DatabaseAvailabilityConfiguration(DatabaseAvailabilityInterceptor availabilityInterceptor) {
        this.availabilityInterceptor = availabilityInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(availabilityInterceptor).excludePathPatterns("/readiness");
    }
}
