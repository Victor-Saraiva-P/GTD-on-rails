package com.gtdonrails.api.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class DatabaseSetupControllerTests {

    @TempDir
    private Path tempDir;

    @Test
    void repairFailureKeepsTheBootstrapEndpointAvailableForRetry() {
        DatabaseSetupService service = mock(DatabaseSetupService.class);
        doThrow(new DatabaseRepairException("temporary failure"))
            .when(service).repair(any(DatabaseSetupRequest.class));
        BootstrapConfiguration configuration = repairableConfiguration();
        DatabaseSetupController controller = new DatabaseSetupController(service, configuration);

        ResponseEntity<DatabaseSetupResponse> response = controller.repair(request());

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, response.getStatusCode());
        assertEquals("REPAIR_FAILED", response.getBody().status());
        assertEquals("REPAIR_FAILED", configuration.configurationStatus());
    }

    @Test
    void successfulRepairMarksBootstrapReady() {
        DatabaseSetupController controller = new DatabaseSetupController(
            mock(DatabaseSetupService.class), repairableConfiguration());

        ResponseEntity<DatabaseSetupResponse> response = controller.repair(request());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("READY", response.getBody().status());
    }

    @Test
    void repairRejectsConfigurationThatDoesNotNeedRepair() {
        DatabaseSetupService service = mock(DatabaseSetupService.class);
        BootstrapConfiguration configuration = configuration();
        DatabaseSetupController controller = new DatabaseSetupController(service, configuration);

        ResponseEntity<DatabaseSetupResponse> response = controller.repair(request());

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("FAILED", response.getBody().status());
    }

    private BootstrapConfiguration configuration() {
        return new BootstrapConfiguration(
            new ObjectMapper(), tempDir.toString(), tempDir.resolve("status.json").toString());
    }

    private BootstrapConfiguration repairableConfiguration() {
        BootstrapConfiguration configuration = configuration();
        configuration.markRepairFailed();
        return configuration;
    }

    private DatabaseSetupRequest request() {
        return new DatabaseSetupRequest("jdbc:postgresql://host:5432/postgres", "user", new char[] {'p'});
    }

}
