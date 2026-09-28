package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

class ClientUpdateInstallerTests {

    @Test
    void updateScriptRunsInAnIndependentUserService() {
        List<String> command = ClientUpdateInstaller.updaterCommand(
            Path.of("/tmp/apply-update.sh"),
            "9475",
            "http://100.127.246.83:9475/health"
        );

        assertEquals(List.of(
            "/usr/bin/systemd-run",
            "--user",
            "--collect",
            "--quiet",
            "--unit=gtd-on-rails-client-update",
            "--setenv=GTD_SYNC_SERVER_PORT=9475",
            "--setenv=GTD_CLIENT_HEALTH_URL=http://100.127.246.83:9475/health",
            "/usr/bin/bash",
            "/tmp/apply-update.sh"
        ), command);
    }
}
