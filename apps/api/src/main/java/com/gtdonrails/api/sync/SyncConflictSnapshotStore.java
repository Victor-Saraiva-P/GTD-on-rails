package com.gtdonrails.api.sync;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SyncConflictSnapshotStore {

    private static final String BASE_FILE = "base.bin";
    private static final String LOCAL_FILE = "local.bin";
    private static final String REMOTE_FILE = "remote.bin";

    private final Path root;

    public SyncConflictSnapshotStore(
        @Value("${gtd.sync.state-directory:${user.home}/.local/state/gtd-on-rails}") String stateRoot
    ) {
        this.root = Path.of(stateRoot).toAbsolutePath().normalize().resolve("conflicts");
    }

    public void save(
        String objectType,
        String objectId,
        long remoteRevision,
        Optional<byte[]> base,
        byte[] local,
        byte[] remote
    ) {
        Path directory = conflictDirectory(objectType, objectId, remoteRevision);
        try {
            Files.createDirectories(directory);
            if (base.isPresent()) Files.write(directory.resolve(BASE_FILE), base.get());
            Files.write(directory.resolve(LOCAL_FILE), local);
            Files.write(directory.resolve(REMOTE_FILE), remote);
        } catch (IOException exception) {
            throw failure("save", directory, exception);
        }
    }

    public ConflictFiles read(String objectType, String objectId, long remoteRevision) {
        Path directory = conflictDirectory(objectType, objectId, remoteRevision);
        try {
            Optional<byte[]> base = Files.isRegularFile(directory.resolve(BASE_FILE))
                ? Optional.of(Files.readAllBytes(directory.resolve(BASE_FILE)))
                : Optional.empty();
            return new ConflictFiles(
                base,
                Files.readAllBytes(directory.resolve(LOCAL_FILE)),
                Files.readAllBytes(directory.resolve(REMOTE_FILE))
            );
        } catch (IOException exception) {
            throw failure("read", directory, exception);
        }
    }

    public void delete(String objectType, String objectId, long remoteRevision) {
        Path directory = conflictDirectory(objectType, objectId, remoteRevision);
        try {
            if (!Files.exists(directory)) return;
            try (var paths = Files.walk(directory)) {
                for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) {
                    Files.deleteIfExists(path);
                }
            }
        } catch (IOException exception) {
            throw failure("delete", directory, exception);
        }
    }

    private Path conflictDirectory(String objectType, String objectId, long revision) {
        return root.resolve(safeSegment(objectType))
            .resolve(safeSegment(objectId))
            .resolve(Long.toString(revision))
            .normalize();
    }

    private String safeSegment(String value) {
        if (value != null && value.matches("[A-Za-z0-9._-]+")) return value;
        throw new IllegalArgumentException(
            "conflict path segment value '" + value + "' is invalid; expected safe object identifier"
        );
    }

    private IllegalStateException failure(String action, Path path, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " sync conflict snapshot at '" + path + "'",
            exception
        );
    }

    public record ConflictFiles(Optional<byte[]> base, byte[] local, byte[] remote) {

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof ConflictFiles files)) return false;
            return optionalBytesEqual(base, files.base)
                && Arrays.equals(local, files.local)
                && Arrays.equals(remote, files.remote);
        }

        @Override
        public int hashCode() {
            return Objects.hash(optionalBytesHash(base), Arrays.hashCode(local), Arrays.hashCode(remote));
        }

        @Override
        public String toString() {
            return "ConflictFiles[baseBytes=" + base.map(value -> value.length).orElse(0)
                + ", localBytes=" + (local == null ? 0 : local.length)
                + ", remoteBytes=" + (remote == null ? 0 : remote.length) + "]";
        }

        private static boolean optionalBytesEqual(Optional<byte[]> left, Optional<byte[]> right) {
            if (left.isEmpty() || right.isEmpty()) return left.isEmpty() && right.isEmpty();
            return Arrays.equals(left.orElseThrow(), right.orElseThrow());
        }

        private static int optionalBytesHash(Optional<byte[]> value) {
            return value.map(Arrays::hashCode).orElse(0);
        }
    }
}
