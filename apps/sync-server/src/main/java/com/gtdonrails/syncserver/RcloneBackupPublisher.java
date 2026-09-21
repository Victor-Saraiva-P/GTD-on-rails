package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RcloneBackupPublisher {

    private final boolean enabled;
    private final String command;
    private final String remote;

    @Autowired
    public RcloneBackupPublisher(
        @Value("${gtd.sync-server.rclone.enabled:false}") boolean enabled,
        @Value("${gtd.sync-server.rclone.command:rclone}") String command,
        @Value("${gtd.sync-server.rclone.remote:}") String remote
    ) {
        this.enabled = enabled;
        this.command = command;
        this.remote = remote;
    }


    /**
     * Copies one immutable snapshot to the configured backup remote.
     *
     * <p>Example: {@code publisher.publish(snapshot)}.</p>
     */
    public void publish(Path snapshot) {
        if (!enabled) return;
        if (remote == null || remote.isBlank()) {
            throw new IllegalStateException(
                "rclone remote value '" + remote + "' is invalid; expected non-blank backup destination"
            );
        }
        run(List.of(command, "copy", snapshot.toString(), remote));
    }

    private void run(List<String> commandLine) {
        try {
            Process process = new ProcessBuilder(commandLine).redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException("rclone backup command failed: " + output.trim());
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to execute rclone backup command", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("rclone backup command interrupted", exception);
        }
    }
}
