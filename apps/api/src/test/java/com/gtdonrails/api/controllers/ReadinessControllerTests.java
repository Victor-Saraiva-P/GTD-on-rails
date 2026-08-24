package com.gtdonrails.api.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.gtdonrails.api.services.DatabaseReadinessResponse;
import com.gtdonrails.api.services.DatabaseReadinessService;
import com.gtdonrails.api.services.DatabaseReadinessState;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class ReadinessControllerTests {

    @Test
    void reportsOkWhenPostgresqlIsReady() {
        DatabaseReadinessService service = mock(DatabaseReadinessService.class);
        when(service.readinessState()).thenReturn(DatabaseReadinessState.READY);

        ReadinessController controller = new ReadinessController(service);
        ResponseEntity<DatabaseReadinessResponse> response = controller.readiness();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("READY", response.getBody().status());
    }

    @Test
    void reportsUpdateRequiredWhenSchemaRequiresNewerRelease() {
        DatabaseReadinessService service = mock(DatabaseReadinessService.class);
        when(service.readinessState()).thenReturn(DatabaseReadinessState.UPDATE_REQUIRED);

        ReadinessController controller = new ReadinessController(service);
        ResponseEntity<DatabaseReadinessResponse> response = controller.readiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("UPDATE_REQUIRED", response.getBody().status());
    }

    @Test
    void reportsServiceUnavailableWhenPostgresqlIsUnavailable() {
        DatabaseReadinessService service = mock(DatabaseReadinessService.class);
        when(service.readinessState()).thenReturn(DatabaseReadinessState.UNAVAILABLE);

        ReadinessController controller = new ReadinessController(service);
        ResponseEntity<DatabaseReadinessResponse> response = controller.readiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("UNAVAILABLE", response.getBody().status());
    }
}
