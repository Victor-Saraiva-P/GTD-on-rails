package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.config.DataSyncProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RcloneDataSyncService {

    private static final Logger logger = LoggerFactory.getLogger(RcloneDataSyncService.class);

    private final DataSyncProperties dataSyncProperties;

    public RcloneDataSyncService(DataSyncProperties dataSyncProperties) {
        this.dataSyncProperties = dataSyncProperties;
    }

    /**
     * Reports whether rclone data synchronization is configured on.
     *
     * <p>Example: {@code rcloneDataSyncService.isEnabled()}.</p>
     */
    public boolean isEnabled() {
        return dataSyncProperties.getRclone().isEnabled();
    }

    /**
     * Runs an incremental rclone bisync for the local data root.
     *
     * <p>Example: {@code rcloneDataSyncService.bisync(dataRoot)}.</p>
     */
    public void bisync(Path dataRoot) {
        if (!isEnabled()) return;

        List<String> arguments = new ArrayList<>(List.of("bisync", dataRoot.toString(), remote()));
        if (dataSyncProperties.isForce()) arguments.add("--force");
        runRclone(arguments);
    }

    /**
     * Runs the initial rclone bisync resync from remote path to local path.
     *
     * <p>Example: {@code rcloneDataSyncService.bootstrapBisync(dataRoot)}.</p>
     */
    public void bootstrapBisync(Path dataRoot) {
        if (!isEnabled()) return;

        runRclone(List.of("bisync", dataRoot.toString(), remote(), "--resync", "--resync-mode", "path2"));
    }

    private String remote() {
        String remote = dataSyncProperties.getRclone().getRemote();
        if (!StringUtils.hasText(remote)) {
            throw new IllegalStateException("Missing gtd.sync.rclone.remote");
        }

        return remote;
    }

    private void runRclone(List<String> arguments) {
        List<String> command = new ArrayList<>();
        command.add(dataSyncProperties.getRclone().getCommand());
        command.addAll(arguments);
        executeRcloneCommand(command);
        logger.atInfo()
            .addKeyValue("event", "rclone_command_completed")
            .addKeyValue("arguments", String.join(" ", arguments))
            .log("rclone command completed");
    }

    private void executeRcloneCommand(List<String> command) {
        try {
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();
            if (exitCode != 0) throw new IllegalStateException("rclone command failed: " + output.trim());
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to execute rclone command", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("rclone command interrupted", exception);
        }
    }

}
