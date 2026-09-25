package com.gtdonrails.syncserver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ClientUpdateService {

    private final ClientReleaseClient releases;
    private final ClientUpdateInstaller installer;
    private final ClientProcessTerminator terminator;
    private final Path installDir;
    private final boolean autoUpdate;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private volatile String latestVersion;
    private volatile boolean latestInstallable;
    private volatile Instant lastCheckedAt;
    private volatile String lastError;
    private volatile String state = "IDLE";

    public ClientUpdateService(
        ClientReleaseClient releases,
        ClientUpdateInstaller installer,
        ClientProcessTerminator terminator,
        @Value("$" + "{gtd.client.install-dir:}") String installDir,
        @Value("$" + "{gtd.client.auto-update.enabled:true}") boolean autoUpdate
    ) {
        this.releases = releases;
        this.installer = installer;
        this.terminator = terminator;
        this.installDir = installDir == null || installDir.isBlank()
            ? null
            : Path.of(installDir).toAbsolutePath().normalize();
        this.autoUpdate = autoUpdate;
    }

    @Scheduled(
        initialDelayString = "$" + "{gtd.client.auto-update.initial-delay-ms:30000}",
        fixedDelayString = "$" + "{gtd.client.auto-update.interval-ms:21600000}"
    )
    public void scheduledCheck() {
        if (!managed() || !autoUpdate) return;
        checkAndInstall();
    }

    public UpdateStatus status() {
        String current = ClientVersion.current();
        return new UpdateStatus(
            managed(),
            autoUpdate,
            current,
            latestVersion,
            updateAvailable(current),
            state,
            running.get(),
            lastCheckedAt,
            lastError
        );
    }

    public UpdateStatus checkNow() {
        runExclusive(false);
        return status();
    }

    public UpdateStatus installNow() {
        if (!managed()) throw new IllegalStateException("Client is not running from a managed installation");
        runExclusive(true);
        return status();
    }

    private void checkAndInstall() {
        try {
            runExclusive(true);
        } catch (RuntimeException exception) {
            // Status retains the failure for the dashboard; scheduled checks must keep running.
        }
    }

    private void runExclusive(boolean install) {
        if (!running.compareAndSet(false, true)) return;
        try {
            inspectRelease(install);
        } finally {
            running.set(false);
        }
    }

    private void inspectRelease(boolean install) {
        state = "CHECKING";
        try {
            ClientReleaseClient.Release release = releases.release();
            latestVersion = release.version();
            latestInstallable = release.installable();
            lastCheckedAt = Instant.now();
            lastError = null;
            if (install && updateAvailable(ClientVersion.current())) {
                install(release);
            } else {
                state = "IDLE";
            }
        } catch (RuntimeException exception) {
            recordFailure(exception);
            throw exception;
        }
    }

    private void install(ClientReleaseClient.Release release) {
        state = "INSTALLING";
        Path script = installer.prepare(installDir, release);
        installer.launchSwap(installDir, script);
        state = "RESTARTING";
        terminator.exitAfterUpdate();
    }

    private void recordFailure(RuntimeException exception) {
        lastCheckedAt = Instant.now();
        lastError = exception.getMessage();
        state = "FAILED";
    }

    private boolean managed() {
        return installDir != null
            && Files.isRegularFile(installDir.resolve("runtime/bin/gtd-client-runtime"));
    }

    private boolean updateAvailable(String current) {
        if (latestVersion == null || !latestInstallable) return false;
        return ClientVersion.newer(latestVersion, current);
    }

    public record UpdateStatus(
        boolean managedInstallation,
        boolean autoUpdateEnabled,
        String currentVersion,
        String latestVersion,
        boolean updateAvailable,
        String state,
        boolean running,
        Instant lastCheckedAt,
        String lastError
    ) {
    }
}
