package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.gtdonrails.api.exceptions.shared.DatabaseUnavailableException;
import com.gtdonrails.api.services.DatabaseReadinessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

class DatabaseAvailabilityInterceptorTests {

    @Test
    void blocksNormalRequestsWhenPostgresqlReadinessFails() {
        DatabaseReadinessService service = mock(DatabaseReadinessService.class);
        when(service.isReady()).thenReturn(false);
        DatabaseAvailabilityInterceptor interceptor = new DatabaseAvailabilityInterceptor(service);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        Object handler = new Object();

        assertThrows(DatabaseUnavailableException.class,
            () -> interceptor.preHandle(request, response, handler));
    }
}
