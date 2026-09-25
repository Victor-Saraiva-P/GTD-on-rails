package com.gtdonrails.syncserver;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/admin/update")
public class ClientUpdateController {

    private final ClientUpdateService updates;

    public ClientUpdateController(ClientUpdateService updates) {
        this.updates = updates;
    }

    @GetMapping
    public ClientUpdateService.UpdateStatus status() {
        return updates.status();
    }

    @PostMapping("/check")
    public ClientUpdateService.UpdateStatus check() {
        return updates.checkNow();
    }

    @PostMapping("/install")
    public ClientUpdateService.UpdateStatus install() {
        return updates.installNow();
    }
}
