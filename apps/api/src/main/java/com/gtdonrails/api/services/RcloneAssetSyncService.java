package com.gtdonrails.api.services;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.config.AssetsProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RcloneAssetSyncService {

    private static final Logger logger = LoggerFactory.getLogger(RcloneAssetSyncService.class);

    private final AssetsProperties assetsProperties;

    public RcloneAssetSyncService(AssetsProperties assetsProperties) {
        this.assetsProperties = assetsProperties;
    }

    public boolean isEnabled() {
        return assetsProperties.getRclone().isEnabled();
    }

    public void bisync(Path localDirectory) {
        if (!isEnabled()) {
            return;
        }

        List<String> arguments = new ArrayList<>(List.of("bisync", localDirectory.toString(), remote()));
        if (assetsProperties.getSync().isForce()) {
            arguments.add("--force");
        }

        runRclone(arguments);
    }

    public void bootstrapBisync(Path localDirectory) {
        if (!isEnabled()) {
            return;
        }

        runRclone(List.of("bisync", localDirectory.toString(), remote(), "--resync", "--resync-mode", "path2"));
    }

    private String remote() {
        String remote = assetsProperties.getRclone().getRemote();
        if (!StringUtils.hasText(remote)) {
            throw new IllegalStateException("Missing gtd.assets.rclone.remote");
        }

        return remote;
    }

    private void runRclone(List<String> arguments) {
        List<String> command = new ArrayList<>();
        command.add(assetsProperties.getRclone().getCommand());
        command.addAll(arguments);

        try {
            Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException("rclone command failed: " + output.trim());
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to execute rclone command", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("rclone command interrupted", exception);
        }

        logger.info("rclone command completed: {}", String.join(" ", arguments));
    }

}
