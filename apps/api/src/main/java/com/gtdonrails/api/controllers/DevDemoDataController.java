package com.gtdonrails.api.controllers;

import com.gtdonrails.api.services.DemoDataSeedService;
import com.gtdonrails.api.services.DemoDataSeedService.DemoSeedResult;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("dev")
@RequestMapping("/dev/demo")
public class DevDemoDataController {

    private final DemoDataSeedService demoDataSeedService;

    public DevDemoDataController(DemoDataSeedService demoDataSeedService) {
        this.demoDataSeedService = demoDataSeedService;
    }

    /**
     * Recreates screenshot-ready development data without touching integration secrets.
     *
     * <p>Example: {@code POST /dev/demo/reset}.</p>
     */
    @PostMapping("/reset")
    public DemoSeedResult resetDemoData() {
        return demoDataSeedService.resetDemoData();
    }
}
