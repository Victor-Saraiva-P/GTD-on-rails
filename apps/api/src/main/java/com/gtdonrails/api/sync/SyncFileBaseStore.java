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
public class SyncFileBaseStore {

    private static final String CONTENT_FILE = "content.bin";
    private static final String REVISION_FILE = "revision";

    private final Path root;

    public SyncFileBaseStore(@Value("${gtd.sync.state-directory:${user.home}/.local/state/gtd-on-rails}") String stateRoot) {
        this.root = Path.of(stateRoot).toAbsolutePath().normalize().resolve("bases");
    }

    public void save(String objectType, String objectId, long revision, byte[] content) {
        Path directory = objectDirectory(objectType, objectId);
        try {
            Files.createDirectories(directory);
            Files.write(directory.resolve(CONTENT_FILE), content);
            Files.writeString(directory.resolve(REVISION_FILE), Long.toString(revision));
        } catch (IOException exception) {
            throw failure("save", directory, exception);
        }
    }

    public Optional<BaseSnapshot> read(String objectType, String objectId, long expectedRevision) {
        Path directory = objectDirectory(objectType, objectId);
        try {
            if (!Files.isRegularFile(directory.resolve(CONTENT_FILE))) return Optional.empty();
            long revision = Long.parseLong(Files.readString(directory.resolve(REVISION_FILE)).trim());
            if (revision != expectedRevision) return Optional.empty();
            return Optional.of(new BaseSnapshot(revision, Files.readAllBytes(directory.resolve(CONTENT_FILE))));
        } catch (IOException | NumberFormatException exception) {
            throw failure("read", directory, exception);
        }
    }

    public void delete(String objectType, String objectId) {
        Path directory = objectDirectory(objectType, objectId);
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

    private Path objectDirectory(String objectType, String objectId) {
        return root.resolve(safeSegment(objectType)).resolve(safeSegment(objectId)).normalize();
    }

    private String safeSegment(String value) {
        if (value != null && value.matches("[A-Za-z0-9._-]+")) return value;
        throw new IllegalArgumentException(
            "sync state path segment value '" + value + "' is invalid; expected safe object identifier"
        );
    }

    private IllegalStateException failure(String action, Path path, Exception exception) {
        return new IllegalStateException(
            "Failed to " + action + " sync base snapshot at '" + path + "'",
            exception
        );
    }

    public record BaseSnapshot(long revision, byte[] content) {

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof BaseSnapshot(long otherRevision, byte[] otherContent))) return false;
            return revision == otherRevision && Arrays.equals(content, otherContent);
        }

        @Override
        public int hashCode() {
            return 31 * Objects.hash(revision) + Arrays.hashCode(content);
        }

        @Override
        public String toString() {
            return "BaseSnapshot[revision=" + revision + ", contentBytes="
                + (content == null ? 0 : content.length) + "]";
        }
    }
}
