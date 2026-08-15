package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.config.FileSyncProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RcloneFileSyncService {

    private static final Logger logger = LoggerFactory.getLogger(RcloneFileSyncService.class);
    private static final List<String> COMMON_FLAGS = List.of(
        "--compare",
        "size,modtime,checksum",
        "--modify-window",
        "1s",
        "--create-empty-src-dirs",
        "--drive-acknowledge-abuse",
        "--drive-skip-gdocs",
        "--drive-skip-shortcuts",
        "--drive-skip-dangling-shortcuts",
        "--metadata"
    );
    private static final List<String> FINAL_FLAGS = List.of(
        "--track-renames",
        "--fix-case",
        "--resilient",
        "--recover",
        "--max-lock",
        "2m"
    );

    private final FileSyncProperties fileSyncProperties;

    public RcloneFileSyncService(FileSyncProperties fileSyncProperties) {
        this.fileSyncProperties = fileSyncProperties;
    }

    /**
     * Reports whether rclone file synchronization is configured on.
     *
     * <p>Example: {@code rcloneFileSyncService.isEnabled()}.</p>
     */
    public boolean isEnabled() {
        return fileSyncProperties.getRclone().isEnabled();
    }

    /**
     * Runs an incremental rclone bisync for the local data root.
     *
     * <p>Example: {@code rcloneFileSyncService.bisync(dataRoot)}.</p>
     */
    public void bisync(Path dataRoot) {
        if (!isEnabled()) return;

        List<String> arguments = baseBisyncArguments(dataRoot, true);
        arguments.add("--check-access");
        arguments.add("--check-filename");
        arguments.add(fileSyncProperties.getSyncCheckFilename());
        runRclone(arguments);
    }

    /**
     * Runs a bisync that can publish the sync check file before access checks are safe.
     *
     * <p>Example: {@code rcloneFileSyncService.publishBootstrapSyncCheck(dataRoot)}.</p>
     */
    public void publishBootstrapSyncCheck(Path dataRoot) {
        if (!isEnabled()) return;

        runRclone(baseBisyncArguments(dataRoot, true));
    }

    /**
     * Runs the initial rclone bisync resync from remote path to local path.
     *
     * <p>Example: {@code rcloneFileSyncService.bootstrapBisync(dataRoot)}.</p>
     */
    public void bootstrapBisync(Path dataRoot) {
        if (!isEnabled()) return;

        List<String> arguments = baseBisyncArguments(dataRoot, false);
        arguments.add("--resync");
        runRclone(arguments);
    }

    private List<String> baseBisyncArguments(Path dataRoot, boolean includeFinalFlags) {
        List<String> arguments = new ArrayList<>(List.of("bisync", remote(), dataRoot.toString()));
        if (fileSyncProperties.isForce()) arguments.add("--force");
        arguments.addAll(COMMON_FLAGS);
        if (includeFinalFlags) arguments.addAll(FINAL_FLAGS);
        return arguments;
    }

    private String remote() {
        String remote = fileSyncProperties.getRclone().getRemote();
        if (!StringUtils.hasText(remote)) {
            throw new IllegalStateException("gtd.sync.rclone.remote is '%s'; expected non-empty remote string".formatted(remote));
        }

        return remote;
    }

    private void runRclone(List<String> arguments) {
        List<String> command = new ArrayList<>();
        command.add(fileSyncProperties.getRclone().getCommand());
        command.addAll(arguments);
        executeRcloneCommand(command);
        logger.atInfo()
            .addKeyValue("event", "rclone_command_completed")
            .addKeyValue("arguments", String.join(" ", arguments))
            .log("rclone command completed");
    }

    protected void executeRcloneCommand(List<String> command) {
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
