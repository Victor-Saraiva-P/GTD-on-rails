package com.gtdonrails.api.bodydocuments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileSystemBodyDocumentStoreTests {

    @TempDir
    Path tempDirectory;

    @Test
    void storesBodyAtStableItemPath() {
        UUID itemId = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        FileSystemBodyDocumentStore store = new FileSystemBodyDocumentStore(tempDirectory.toString());

        store.write(itemId, "# Body\n");

        assertEquals("# Body\n", store.read(itemId).orElseThrow());
        assertTrue(Files.isRegularFile(tempDirectory.resolve("items").resolve(itemId.toString()).resolve("body.md")));
    }

    @Test
    void leavesNoTemporaryFileAfterAtomicWrite() throws Exception {
        UUID itemId = UUID.randomUUID();
        FileSystemBodyDocumentStore store = new FileSystemBodyDocumentStore(tempDirectory.toString());

        store.write(itemId, "first");
        store.write(itemId, "second");

        Path itemDirectory = tempDirectory.resolve("items").resolve(itemId.toString());
        try (var files = Files.list(itemDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString().contains(".tmp")));
        }
        assertEquals("second", store.read(itemId).orElseThrow());
    }
}
