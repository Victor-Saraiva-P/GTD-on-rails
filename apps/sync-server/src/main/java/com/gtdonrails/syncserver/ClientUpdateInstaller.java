package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.stereotype.Component;

@Component
public class ClientUpdateInstaller {

    private final ClientReleaseClient releases;

    public ClientUpdateInstaller(ClientReleaseClient releases) {
        this.releases = releases;
    }

    public Path prepare(
        Path installDir,
        ClientReleaseClient.Release release
    ) {
        Path updateDir = updateDirectory(release.version());
        Path archive = updateDir.resolve(ClientReleaseClient.archiveName(release.version()));
        byte[] archiveBytes = releases.download(release.archiveUrl());
        byte[] checksumBytes = releases.download(release.checksumUrl());
        resetDirectory(updateDir);
        write(archive, archiveBytes);
        verifyChecksum(archiveBytes, checksumBytes, archive.getFileName().toString());
        return extractAndStage(installDir, release.version(), updateDir, archive);
    }

    public void launchSwap(Path installDir, Path updateScript) {
        try {
            new ProcessBuilder("bash", updateScript.toString()).start();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to launch client updater", exception);
        }
    }

    private Path extractAndStage(
        Path installDir,
        String version,
        Path updateDir,
        Path archive
    ) {
        Path extractDir = updateDir.resolve("extracted");
        Filesystem.ensureDirectory(extractDir);
        run("tar", "-xzf", archive.toString(), "-C", extractDir.toString());
        Path packageDir = extractDir.resolve(packageName(version));
        validatePackage(packageDir, version);
        Path nextDir = sibling(installDir, ".next");
        stagePackage(packageDir, nextDir);
        return writeSwapScript(installDir, nextDir, updateDir, version);
    }

    private void stagePackage(Path packageDir, Path nextDir) {
        Filesystem.deleteIfExists(nextDir);
        Filesystem.ensureDirectory(nextDir);
        run("cp", "-a", packageDir + "/.", nextDir.toString());
    }

    private Path writeSwapScript(
        Path installDir,
        Path nextDir,
        Path updateDir,
        String version
    ) {
        Path script = updateDir.resolve("apply-update.sh");
        String content = swapScript(installDir, nextDir, version);
        write(script, content.getBytes(StandardCharsets.UTF_8));
        script.toFile().setExecutable(true, true);
        return script;
    }

    private String swapScript(Path installDir, Path nextDir, String version) {
        Path previousDir = sibling(installDir, ".previous");
        return """
            #!/usr/bin/env bash
            set -euo pipefail
            install_dir=%s
            next_dir=%s
            previous_dir=%s
            expected_version=%s
            current_pid=%d
            port="${GTD_SYNC_SERVER_PORT:-9475}"
            health_url="${GTD_CLIENT_HEALTH_URL:-http://127.0.0.1:${port}/health}"
            while kill -0 "$current_pid" >/dev/null 2>&1; do sleep 0.2; done
            test -x "$next_dir/gtd-client"
            test -x "$next_dir/runtime/bin/gtd-client-runtime"
            rm -rf "$previous_dir"
            if [ -d "$install_dir" ]; then mv "$install_dir" "$previous_dir"; fi
            if ! mv "$next_dir" "$install_dir"; then
              if [ -d "$previous_dir" ]; then mv "$previous_dir" "$install_dir"; fi
              exit 1
            fi
            if command -v systemctl >/dev/null 2>&1 && systemctl --user is-enabled gtd-on-rails-client.service >/dev/null 2>&1; then
              systemctl --user restart gtd-on-rails-client.service
              for _ in $(seq 1 60); do
                if curl -fsS "$health_url" | grep -F "\"version\":\"$expected_version\"" >/dev/null; then exit 0; fi
                sleep 0.5
              done
              systemctl --user stop gtd-on-rails-client.service || true
              rm -rf "$install_dir"
              if [ -d "$previous_dir" ]; then mv "$previous_dir" "$install_dir"; fi
              systemctl --user restart gtd-on-rails-client.service
              exit 1
            fi
            nohup "$install_dir/gtd-client" >/dev/null 2>&1 &
            """.formatted(
                shellQuote(installDir),
                shellQuote(nextDir),
                shellQuote(previousDir),
                shellQuote(version),
                ProcessHandle.current().pid()
            );
    }

    private void verifyChecksum(
        byte[] archive,
        byte[] checksum,
        String archiveName
    ) {
        String expected = checksumToken(checksum, archiveName);
        String actual = HexFormat.of().formatHex(sha256(archive));
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalStateException("Client update checksum does not match downloaded archive");
        }
    }

    private String checksumToken(byte[] checksum, String archiveName) {
        String line = new String(checksum, StandardCharsets.UTF_8).trim();
        String[] parts = line.split("\\s+");
        if (parts.length >= 2 && parts[1].replaceFirst("^\\*", "").equals(archiveName)) {
            return parts[0].toLowerCase();
        }
        throw new IllegalStateException("Client update checksum file is invalid");
    }

    private byte[] sha256(byte[] content) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(content);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private void validatePackage(Path packageDir, String version) {
        requireFile(packageDir.resolve("gtd-client"));
        requireFile(packageDir.resolve("runtime/bin/gtd-client-runtime"));
        String packagedVersion = Filesystem.readText(packageDir.resolve("VERSION")).trim();
        if (!version.equals(packagedVersion)) {
            throw new IllegalStateException("Client update package version does not match release version");
        }
    }

    private void requireFile(Path path) {
        if (Files.isRegularFile(path)) return;
        throw new IllegalStateException(
            "Client update package file '" + path + "' is missing"
        );
    }

    private Path updateDirectory(String version) {
        String home = System.getProperty("user.home");
        return Path.of(home, ".cache", "gtd-on-rails-client", "updates", version);
    }

    private void resetDirectory(Path path) {
        Filesystem.deleteIfExists(path);
        Filesystem.ensureDirectory(path);
    }

    private Path sibling(Path installDir, String suffix) {
        return installDir.resolveSibling(installDir.getFileName() + suffix);
    }

    private String packageName(String version) {
        return "GTD.on.Rails.Client_" + version + "_linux-x86_64";
    }

    private String shellQuote(Path path) {
        return shellQuote(path.toString());
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private void write(Path path, byte[] content) {
        try {
            Files.write(path, content);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write client update file '" + path + "'", exception);
        }
    }

    private void run(String... command) {
        try {
            Process process = new ProcessBuilder(command).inheritIO().start();
            if (process.waitFor() == 0) return;
            throw new IllegalStateException("Client update command failed: " + String.join(" ", command));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to run client update command", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Client update command was interrupted", exception);
        }
    }

    private static final class Filesystem {

        private Filesystem() {
        }

        static void ensureDirectory(Path path) {
            try {
                Files.createDirectories(path);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to create directory '" + path + "'", exception);
            }
        }

        static void deleteIfExists(Path path) {
            if (!Files.exists(path)) return;
            try (var paths = Files.walk(path)) {
                paths.sorted(java.util.Comparator.reverseOrder())
                    .forEach(Filesystem::deletePath);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to remove directory '" + path + "'", exception);
            }
        }

        static String readText(Path path) {
            try {
                return Files.readString(path);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to read file '" + path + "'", exception);
            }
        }

        private static void deletePath(Path path) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to remove path '" + path + "'", exception);
            }
        }
    }
}
