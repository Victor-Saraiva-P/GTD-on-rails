package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SyncFileService {

    private final SyncObjectStore store;
    private final Path filesRoot;

    @Autowired
    public SyncFileService(
        SyncObjectStore store,
        @Value("${gtd.sync-server.files-root}") String filesRoot
    ) {
        this.store = store;
        this.filesRoot = Path.of(filesRoot).toAbsolutePath().normalize();
        createFilesRoot();
    }

    /**
     * Applies a versioned file mutation and stores bytes outside SQLite.
     *
     * <p>Example: {@code files.apply(mutation, markdownBytes)}.</p>
     */
    public SyncMutationResult apply(SyncFileMutation mutation, byte[] content) {
        synchronized (store) {
            var repeated = store.operationResult(mutation.operationId());
            if (repeated.isPresent()) return repeated.get();
            Path target = resolveRelativePath(mutation.relativePath());
            if ("DELETE".equals(mutation.operation())) return delete(mutation, target);
            byte[] bytes = content == null ? new byte[0] : content;
            String hash = sha256(bytes);
            verifyExpectedHash(mutation.sha256(), hash);
            return writeVersionedFile(mutation, target, bytes, hash);
        }
    }

    /**
     * Reads the current canonical bytes for a file object.
     *
     * <p>Example: {@code files.read("body_document", itemId)}.</p>
     */
    public SyncFileContent read(String objectType, String objectId) {
        SyncObjectSnapshot object = store.object(objectType, objectId)
            .orElseThrow(() -> new SyncObjectNotFoundException(objectType, objectId));
        if (object.deleted()) throw new SyncObjectNotFoundException(objectType, objectId);
        Path path = resolveRelativePath(object.payload());
        try {
            return new SyncFileContent(
                Files.readAllBytes(path),
                object.payload(),
                object.sha256(),
                object.mediaType(),
                object.revision()
            );
        } catch (IOException exception) {
            throw fileFailure("read", path, exception);
        }
    }

    private SyncMutationResult writeVersionedFile(
        SyncFileMutation mutation,
        Path target,
        byte[] content,
        String hash
    ) {
        Path staged = stage(content);
        Path previous = preserveCurrent(target);
        try {
            moveIntoPlace(staged, target);
            SyncMutationResult result = store.apply(toStoreMutation(mutation, (long) content.length, hash));
            deleteStagedQuietly(previous);
            return result;
        } catch (RuntimeException exception) {
            restorePrevious(target, previous);
            throw exception;
        } finally {
            deleteStagedQuietly(staged);
        }
    }

    private SyncMutationResult delete(SyncFileMutation mutation, Path target) {
        Path previous = preserveCurrent(target);
        try {
            SyncMutationResult result = store.apply(toStoreMutation(mutation, null, null));
            deleteStagedQuietly(previous);
            return result;
        } catch (RuntimeException exception) {
            restorePrevious(target, previous);
            throw exception;
        }
    }

    private Path preserveCurrent(Path target) {
        if (!Files.exists(target)) return null;
        try {
            Path staging = filesRoot.resolve(".staging");
            Files.createDirectories(staging);
            Path previous = Files.createTempFile(staging, "previous-", ".tmp");
            Files.move(target, previous, StandardCopyOption.REPLACE_EXISTING);
            return previous;
        } catch (IOException exception) {
            throw fileFailure("preserve", target, exception);
        }
    }

    private void restorePrevious(Path target, Path previous) {
        try {
            Files.deleteIfExists(target);
            if (previous != null && Files.exists(previous)) moveIntoPlace(previous, target);
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to restore previous sync file at '" + target + "'", exception);
        }
    }

    private SyncMutation toStoreMutation(
        SyncFileMutation mutation,
        Long byteLength,
        String hash
    ) {
        return new SyncMutation(
            mutation.operationId(),
            mutation.objectType(),
            mutation.objectId(),
            mutation.baseRevision(),
            mutation.operation(),
            mutation.relativePath(),
            hash,
            byteLength,
            mutation.mediaType()
        );
    }

    private Path stage(byte[] content) {
        try {
            Path staging = filesRoot.resolve(".staging");
            Files.createDirectories(staging);
            Path path = Files.createTempFile(staging, "sync-", ".tmp");
            Files.write(path, content);
            return path;
        } catch (IOException exception) {
            throw fileFailure("stage", filesRoot, exception);
        }
    }

    private void moveIntoPlace(Path source, Path target) {
        try {
            Files.createDirectories(target.getParent());
            tryAtomicMove(source, target);
        } catch (IOException exception) {
            throw fileFailure("write", target, exception);
        }
    }

    private void tryAtomicMove(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Path resolveRelativePath(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw invalidRelativePath(relativePath);
        }
        Path raw = Path.of(relativePath);
        if (raw.isAbsolute() || containsParentTraversal(raw)) throw invalidRelativePath(relativePath);
        Path resolved = filesRoot.resolve(raw).normalize();
        if (!resolved.startsWith(filesRoot)) throw invalidRelativePath(relativePath);
        return resolved;
    }

    private boolean containsParentTraversal(Path path) {
        for (Path segment : path) {
            if ("..".equals(segment.toString())) return true;
        }
        return false;
    }

    private IllegalArgumentException invalidRelativePath(String value) {
        return new IllegalArgumentException(
            "relative path value '" + value + "' is invalid; expected path inside sync files root"
        );
    }

    private void verifyExpectedHash(String expected, String actual) {
        if (expected == null || expected.isBlank() || expected.equalsIgnoreCase(actual)) return;
        throw new IllegalArgumentException(
            "sha256 value '" + expected + "' is invalid; expected content hash '" + actual + "'"
        );
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm unavailable; expected JDK SHA-256 provider", exception);
        }
    }

    private void createFilesRoot() {
        try {
            Files.createDirectories(filesRoot);
        } catch (IOException exception) {
            throw fileFailure("create", filesRoot, exception);
        }
    }

    private void deleteStagedQuietly(Path staged) {
        if (staged == null) return;
        try {
            Files.deleteIfExists(staged);
        } catch (IOException ignored) {
            // WHY: a failed staging cleanup must not hide the canonical mutation result.
        }
    }

    private IllegalStateException fileFailure(String action, Path path, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " sync file at '" + path + "'; expected accessible server file storage",
            exception
        );
    }
}
