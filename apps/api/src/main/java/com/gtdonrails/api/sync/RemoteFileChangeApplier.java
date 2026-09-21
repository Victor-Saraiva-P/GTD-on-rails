package com.gtdonrails.api.sync;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RemoteFileChangeApplier {

    private static final Set<String> FILE_OBJECT_TYPES = Set.of(
        "body_document",
        "item_asset_file",
        "context_icon_file"
    );

    private final SyncFileServerGateway gateway;
    private final SyncFileBaseStore baseStore;
    private final Path dataRoot;

    public RemoteFileChangeApplier(
        SyncFileServerGateway gateway,
        SyncFileBaseStore baseStore,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.gateway = gateway;
        this.baseStore = baseStore;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    public boolean supports(String objectType) {
        return FILE_OBJECT_TYPES.contains(objectType);
    }

    /**
     * Applies one remote file change into the local data root.
     *
     * <p>Example: {@code applier.apply(change)}.</p>
     */
    public void apply(SyncRemoteChange change) {
        if ("DELETE".equals(change.operation())) {
            delete(change.payload());
            baseStore.delete(change.objectType(), change.objectId());
            return;
        }
        SyncFileServerGateway.RemoteFileContent remote = gateway.read(change.objectType(), change.objectId());
        write(remote.relativePath(), remote.content());
        baseStore.save(change.objectType(), change.objectId(), remote.revision(), remote.content());
    }

    private void write(String relativePath, byte[] content) {
        Path target = resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            Path temporary = Files.createTempFile(target.getParent(), ".sync-", ".tmp");
            try {
                Files.write(temporary, content);
                move(temporary, target);
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException exception) {
            throw fileFailure("write", target, exception);
        }
    }

    private void delete(String relativePath) {
        Path target = resolve(relativePath);
        try {
            Files.deleteIfExists(target);
        } catch (IOException exception) {
            throw fileFailure("delete", target, exception);
        }
    }

    private Path resolve(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) throw invalidPath(relativePath);
        Path raw = Path.of(relativePath);
        if (raw.isAbsolute() || hasParentTraversal(raw)) throw invalidPath(relativePath);
        Path target = dataRoot.resolve(raw).normalize();
        if (!target.startsWith(dataRoot)) throw invalidPath(relativePath);
        return target;
    }

    private boolean hasParentTraversal(Path path) {
        for (Path segment : path) {
            if ("..".equals(segment.toString())) return true;
        }
        return false;
    }

    private void move(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private IllegalArgumentException invalidPath(String value) {
        return new IllegalArgumentException(
            "remote file path value '" + value + "' is invalid; expected path inside local data root"
        );
    }

    private IllegalStateException fileFailure(String action, Path path, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " remote sync file at '" + path + "'",
            exception
        );
    }
}
