package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SyncServerAuthFilter extends OncePerRequestFilter {

    private final String token;

    public SyncServerAuthFilter(
        @Value("${gtd.sync-server.auth-token:}") String token
    ) {
        this.token = token == null ? "" : token.trim();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return token.isBlank() || !request.getRequestURI().startsWith("/v1/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        if (!matches(request.getHeader("Authorization"))) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "missing or invalid sync-server bearer token");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean matches(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return false;
        byte[] expected = token.getBytes(StandardCharsets.UTF_8);
        byte[] actual = authorization.substring("Bearer ".length())
            .getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }
}
