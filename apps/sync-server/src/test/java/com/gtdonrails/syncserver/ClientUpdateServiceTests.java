package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClientUpdateServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void repositoryRuntimeIsNotManagedInstallation() {
        ClientReleaseClient releases = mock(ClientReleaseClient.class);
        ClientUpdateInstaller installer = mock(ClientUpdateInstaller.class);
        ClientProcessTerminator terminator = mock(ClientProcessTerminator.class);
        ClientUpdateService service = new ClientUpdateService(
            releases,
            installer,
            terminator,
            "",
            true
        );

        assertFalse(service.status().managedInstallation());

        service.scheduledCheck();
        verifyNoInteractions(releases, installer, terminator);
    }

    @Test
    void installedJarMarksRuntimeAsManaged() throws Exception {
        Path install = tempDirectory.resolve("client");
        java.nio.file.Files.createDirectories(install.resolve("runtime/bin"));
        java.nio.file.Files.writeString(
            install.resolve("runtime/bin/gtd-client-runtime"),
            "launcher"
        );
        ClientUpdateService service = new ClientUpdateService(
            mock(ClientReleaseClient.class),
            mock(ClientUpdateInstaller.class),
            mock(ClientProcessTerminator.class),
            install.toString(),
            true
        );

        assertTrue(service.status().managedInstallation());
        assertTrue(service.status().autoUpdateEnabled());
    }
}
