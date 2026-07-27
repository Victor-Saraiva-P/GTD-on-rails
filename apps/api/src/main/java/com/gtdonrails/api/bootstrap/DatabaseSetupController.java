package com.gtdonrails.api.bootstrap;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
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

    /** Returns the bootstrap configuration state.
     *
     * <p>Example: {@code GET /bootstrap/status}.</p>
     */
    @GetMapping("/status")
    public DatabaseSetupResponse status() {
        return new DatabaseSetupResponse(bootstrapConfiguration.configurationStatus());
    }

    /** Provisions the remote application database.
     *
     * <p>Example: {@code POST /bootstrap/database}.</p>
     */
    @PostMapping("/database")
    public ResponseEntity<DatabaseSetupResponse> setup(@RequestBody DatabaseSetupRequest request) {
        setupService.provision(request);
        bootstrapConfiguration.markReady();
        return ResponseEntity.ok(new DatabaseSetupResponse("READY"));
    }

    /** Rotates the limited role after validating a fresh administrative connection.
     *
     * <p>Example: {@code POST /bootstrap/database/repair}.</p>
     */
    @PostMapping("/database/repair")
    public ResponseEntity<DatabaseSetupResponse> repair(@RequestBody DatabaseSetupRequest request) {
        try {
            setupService.repair(request);
            bootstrapConfiguration.markReady();
            return ResponseEntity.ok(new DatabaseSetupResponse("READY"));
        } catch (DatabaseRepairException exception) {
            bootstrapConfiguration.markRepairFailed();
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new DatabaseSetupResponse("REPAIR_FAILED"));
        }
    }
}
