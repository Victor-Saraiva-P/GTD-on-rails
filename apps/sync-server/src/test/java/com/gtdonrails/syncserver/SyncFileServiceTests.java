package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SyncFileServiceTests {

    @TempDir
    Path tempDirectory;

    @Test
    void writesVersionedFileUnderServerFilesRoot() throws Exception {
        SyncObjectStore store = new SyncObjectStore(tempDirectory.resolve("canonical.db"));
        SyncFileService files = new SyncFileService(store, tempDirectory.resolve("files").toString());
        byte[] content = "# Body".getBytes(StandardCharsets.UTF_8);
        SyncFileMutation mutation = mutation(0, "body_document", "item-1", "items/item-1/body.md");

        SyncMutationResult result = files.apply(mutation, content);

        assertEquals(1, result.revision());
        assertArrayEquals(content, Files.readAllBytes(tempDirectory.resolve("files/items/item-1/body.md")));
        assertArrayEquals(content, files.read("body_document", "item-1").content());
    }


    @Test
    void replayedOperationIdDoesNotReplaceCanonicalBytes() throws Exception {
        SyncObjectStore store = new SyncObjectStore(tempDirectory.resolve("canonical.db"));
        SyncFileService files = new SyncFileService(store, tempDirectory.resolve("files").toString());
        UUID operationId = UUID.randomUUID();
        SyncFileMutation mutation = new SyncFileMutation(
            operationId, "body_document", "item-1", 0, "UPSERT",
            "items/item-1/body.md", null, "text/markdown"
        );
        SyncMutationResult first = files.apply(mutation, "original".getBytes(StandardCharsets.UTF_8));

        SyncMutationResult replay = files.apply(mutation, "different".getBytes(StandardCharsets.UTF_8));

        assertEquals(first, replay);
        assertEquals("original", Files.readString(tempDirectory.resolve("files/items/item-1/body.md")));
    }

    @Test
    void staleMutationDoesNotOverwriteCurrentFile() throws Exception {
        SyncObjectStore store = new SyncObjectStore(tempDirectory.resolve("canonical.db"));
        SyncFileService files = new SyncFileService(store, tempDirectory.resolve("files").toString());
        SyncFileMutation initial = mutation(0, "body_document", "item-1", "items/item-1/body.md");
        files.apply(initial, "one".getBytes(StandardCharsets.UTF_8));

        SyncFileMutation stale = mutation(0, "body_document", "item-1", "items/item-1/body.md");

        assertThrows(
            SyncConflictException.class,
            () -> files.apply(stale, "stale".getBytes(StandardCharsets.UTF_8))
        );
        assertEquals("one", Files.readString(tempDirectory.resolve("files/items/item-1/body.md")));
    }

    @Test
    void rejectsPathTraversal() {
        SyncObjectStore store = new SyncObjectStore(tempDirectory.resolve("canonical.db"));
        SyncFileService files = new SyncFileService(store, tempDirectory.resolve("files").toString());

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> files.apply(mutation(0, "item_asset", "asset-1", "../outside.txt"), new byte[] {1})
        );

        assertEquals(
            "relative path value '../outside.txt' is invalid; expected path inside sync files root",
            exception.getMessage()
        );
    }

    private SyncFileMutation mutation(
        long baseRevision,
        String objectType,
        String objectId,
        String relativePath
    ) {
        return new SyncFileMutation(
            UUID.randomUUID(),
            objectType,
            objectId,
            baseRevision,
            "UPSERT",
            relativePath,
            null,
            "text/markdown"
        );
    }
}
