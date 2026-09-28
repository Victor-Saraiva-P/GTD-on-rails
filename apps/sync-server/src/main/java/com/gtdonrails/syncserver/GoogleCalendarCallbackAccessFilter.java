package com.gtdonrails.syncserver;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@ConditionalOnProperty(name = "gtd.sync-server.google-calendar.callback-listener.enabled", havingValue = "true")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GoogleCalendarCallbackAccessFilter extends OncePerRequestFilter {

    private final int callbackPort;

    public GoogleCalendarCallbackAccessFilter(
        @Value("${gtd.sync-server.google-calendar.callback-listener.port:7676}") int callbackPort
    ) {
        this.callbackPort = callbackPort;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getLocalPort() != callbackPort;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        if (!isGoogleCallback(request)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isGoogleCallback(HttpServletRequest request) {
        return "GET".equals(request.getMethod())
            && "/oauth/google/callback".equals(request.getRequestURI());
    }
}
