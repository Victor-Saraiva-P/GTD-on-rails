package com.gtdonrails.api.config;

import com.gtdonrails.api.exceptions.shared.DatabaseUnavailableException;
import com.gtdonrails.api.services.DatabaseReadinessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class DatabaseAvailabilityInterceptor implements HandlerInterceptor {

    private final DatabaseReadinessService readinessService;

    public DatabaseAvailabilityInterceptor(DatabaseReadinessService readinessService) {
        this.readinessService = readinessService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (readinessService.isReady()) return true;
        throw new DatabaseUnavailableException();
    }
}
