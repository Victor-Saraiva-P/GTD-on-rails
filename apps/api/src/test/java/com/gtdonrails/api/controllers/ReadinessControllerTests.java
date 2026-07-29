package com.gtdonrails.api.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.gtdonrails.api.services.DatabaseReadinessService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ReadinessControllerTests {

    @Test
    void reportsServiceUnavailableWhenPostgresqlReadinessFails() {
        DatabaseReadinessService service = mock(DatabaseReadinessService.class);
        when(service.isReady()).thenReturn(false);

        ReadinessController controller = new ReadinessController(service);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, controller.readiness().getStatusCode());
    }
}
