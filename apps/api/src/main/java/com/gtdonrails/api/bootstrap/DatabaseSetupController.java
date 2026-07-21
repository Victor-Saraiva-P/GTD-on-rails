package com.gtdonrails.api.bootstrap;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.context.annotation.Profile;

@RestController
@RequestMapping("/bootstrap")
@Profile("bootstrap")
public class DatabaseSetupController {

    private final DatabaseSetupService setupService;
    private final BootstrapConfiguration bootstrapConfiguration;

    public DatabaseSetupController(DatabaseSetupService setupService, BootstrapConfiguration bootstrapConfiguration) {
        this.setupService = setupService;
        this.bootstrapConfiguration = bootstrapConfiguration;
    }

    @GetMapping("/status")
    public DatabaseSetupResponse status() {
        return new DatabaseSetupResponse(bootstrapConfiguration.configurationStatus());
    }

    @PostMapping("/database")
    public ResponseEntity<DatabaseSetupResponse> setup(@RequestBody DatabaseSetupRequest request) {
        setupService.provision(request);
        bootstrapConfiguration.markReady();
        return ResponseEntity.ok(new DatabaseSetupResponse("READY"));
    }
}
