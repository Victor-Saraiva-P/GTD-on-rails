package com.gtdonrails.api.sync;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SyncLocalFileStore {

    private final Path dataRoot;

    public SyncLocalFileStore(@Value("${gtd.data.root-directory}") String dataRoot) {
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    public byte[] read(String relativePath) {
        Path path = resolve(relativePath);
        try {
            return Files.readAllBytes(path);
        } catch (IOException exception) {
            throw failure("read", path, exception);
        }
    }

    public void write(String relativePath, byte[] content) {
        Path target = resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            writeAtomically(target, content);
        } catch (IOException exception) {
            throw failure("write", target, exception);
        }
    }

    public void delete(String relativePath) {
        Path target = resolve(relativePath);
        try {
            Files.deleteIfExists(target);
        } catch (IOException exception) {
            throw failure("delete", target, exception);
        }
    }

    public Path resolve(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) throw invalidPath(relativePath);
        Path raw = Path.of(relativePath);
        if (raw.isAbsolute() || hasParentTraversal(raw)) throw invalidPath(relativePath);
        Path path = dataRoot.resolve(raw).normalize();
        if (!path.startsWith(dataRoot)) throw invalidPath(relativePath);
        return path;
    }

    private void writeAtomically(Path target, byte[] content) throws IOException {
        Path temporary = Files.createTempFile(target.getParent(), ".sync-", ".tmp");
        try {
            Files.write(temporary, content);
            move(temporary, target);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void move(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private boolean hasParentTraversal(Path path) {
        for (Path segment : path) {
            if ("..".equals(segment.toString())) return true;
        }
        return false;
    }

    private IllegalArgumentException invalidPath(String value) {
        return new IllegalArgumentException(
            "sync file path value '" + value + "' is invalid; expected path inside local data root"
        );
    }

    private IllegalStateException failure(String action, Path path, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " sync file at '" + path + "'; expected accessible local file",
            exception
        );
    }
}
