package com.gtdonrails.api.bodydocuments;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FileSystemBodyDocumentStore implements BodyDocumentStore {

    private final Path dataRoot;

    public FileSystemBodyDocumentStore(@Value("${gtd.data.root-directory}") String dataRoot) {
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    @Override
    public Optional<String> read(UUID itemId) {
        Path path = bodyPath(itemId);
        if (!Files.isRegularFile(path)) return Optional.empty();
        try {
            return Optional.of(Files.readString(path, StandardCharsets.UTF_8));
        } catch (IOException exception) {
            throw storageFailure("read", path, exception);
        }
    }

    @Override
    public void write(UUID itemId, String markdown) {
        Path path = bodyPath(itemId);
        try {
            Files.createDirectories(path.getParent());
            writeAtomically(path, markdown == null ? "" : markdown);
        } catch (IOException exception) {
            throw storageFailure("write", path, exception);
        }
    }

    @Override
    public boolean exists(UUID itemId) {
        return Files.isRegularFile(bodyPath(itemId));
    }

    private void writeAtomically(Path target, String markdown) throws IOException {
        Path temporary = Files.createTempFile(target.getParent(), ".body-", ".tmp");
        try {
            writeAndForce(temporary, markdown);
            moveIntoPlace(temporary, target);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void writeAndForce(Path path, String markdown) throws IOException {
        byte[] bytes = markdown.getBytes(StandardCharsets.UTF_8);
        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            channel.write(ByteBuffer.wrap(bytes));
            channel.force(true);
        }
    }

    private void moveIntoPlace(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Path bodyPath(UUID itemId) {
        if (itemId == null) {
            throw new IllegalArgumentException("item ID value 'null' is invalid; expected UUID");
        }
        return dataRoot.resolve("items").resolve(itemId.toString()).resolve("body.md");
    }

    private IllegalStateException storageFailure(String action, Path path, IOException exception) {
        return new IllegalStateException(
            "Failed to " + action + " body document at '" + path + "'; expected accessible UTF-8 file",
            exception
        );
    }
}
