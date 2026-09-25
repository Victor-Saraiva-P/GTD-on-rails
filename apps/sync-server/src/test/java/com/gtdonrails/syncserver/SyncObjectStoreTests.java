package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SyncObjectStoreTests {

    @TempDir
    Path tempDirectory;

    @Test
    void acceptsInitialMutationAndPublishesChange() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        SyncMutation mutation = mutation("items", "item-1", 0, "UPSERT", "{\"title\":\"One\"}");

        SyncMutationResult result = store.apply(mutation);

        assertEquals(1, result.revision());
        assertEquals(1, result.cursor());
        assertEquals(1, store.changesAfter(0, 100).changes().size());
        assertEquals("{\"title\":\"One\"}", store.object("items", "item-1").orElseThrow().payload());
    }

    @Test
    void canonicalMutationPersistsGoogleProjectionAtomically() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        GoogleCalendarMirrorStore mirrorStore = new GoogleCalendarMirrorStore(store);

        store.apply(mutation("next_actions", "item-1", 0, "UPSERT", "{}"));

        assertEquals(1L, mirrorStore.pendingCount());
        assertEquals("item-1", mirrorStore.pending(10).getFirst().objectId());
    }

    @Test
    void unrelatedMutationDoesNotCreateGoogleProjection() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        GoogleCalendarMirrorStore mirrorStore = new GoogleCalendarMirrorStore(store);

        store.apply(mutation("contexts", "context-1", 0, "UPSERT", "{}"));

        assertEquals(0L, mirrorStore.pendingCount());
    }

    @Test
    void repeatsOperationIdIdempotently() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        UUID operationId = UUID.randomUUID();
        SyncMutation first = mutation(operationId, "items", "item-1", 0, "UPSERT", "{\"title\":\"One\"}");

        SyncMutationResult initial = store.apply(first);
        SyncMutationResult repeated = store.apply(first);

        assertEquals(initial, repeated);
        assertEquals(1, store.changesAfter(0, 100).changes().size());
    }

    @Test
    void rejectsStaleBaseRevision() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        store.apply(mutation("items", "item-1", 0, "UPSERT", "{\"title\":\"One\"}"));

        SyncConflictException exception = assertThrows(
            SyncConflictException.class,
            () -> store.apply(mutation("items", "item-1", 0, "UPSERT", "{\"title\":\"Stale\"}"))
        );

        assertEquals(1, exception.currentRevision());
    }

    @Test
    void returnsOnlyChangesAfterCursor() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        store.apply(mutation("items", "one", 0, "UPSERT", "{}"));
        SyncMutationResult second = store.apply(mutation("items", "two", 0, "UPSERT", "{}"));
        store.apply(mutation("items", "three", 0, "UPSERT", "{}"));

        SyncChangeFeed feed = store.changesAfter(second.cursor(), 100);

        assertEquals(1, feed.changes().size());
        assertEquals("three", feed.changes().getFirst().objectId());
    }

    @Test
    void deleteCreatesTombstoneRevision() {
        SyncObjectStore store = new SyncObjectStore(databasePath());
        SyncMutationResult first = store.apply(mutation("items", "item-1", 0, "UPSERT", "{}"));

        SyncMutationResult deleted = store.apply(mutation("items", "item-1", first.revision(), "DELETE", null));

        assertEquals(2, deleted.revision());
        assertEquals(true, store.object("items", "item-1").orElseThrow().deleted());
    }

    private Path databasePath() {
        return tempDirectory.resolve("canonical.db");
    }

    private SyncMutation mutation(
        String objectType,
        String objectId,
        long baseRevision,
        String operation,
        String payload
    ) {
        return mutation(UUID.randomUUID(), objectType, objectId, baseRevision, operation, payload);
    }

    private SyncMutation mutation(
        UUID operationId,
        String objectType,
        String objectId,
        long baseRevision,
        String operation,
        String payload
    ) {
        return new SyncMutation(operationId, objectType, objectId, baseRevision, operation, payload, null, null, null);
    }
}
