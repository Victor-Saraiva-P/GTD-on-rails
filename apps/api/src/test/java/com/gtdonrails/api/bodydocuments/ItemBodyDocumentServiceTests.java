package com.gtdonrails.api.bodydocuments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;
import org.junit.jupiter.api.Test;

class ItemBodyDocumentServiceTests {

    @Test
    void readsCanonicalMarkdownWhenDocumentExists() {
        UUID itemId = UUID.randomUUID();
        FakeBodyDocumentStore store = new FakeBodyDocumentStore();
        store.write(itemId, "# Canonical");
        ItemBodyDocumentService service = new ItemBodyDocumentService(store, new ItemBodyMarkdownCodec());

        ItemBody body = service.read(itemId, new ItemBody("legacy", null, null, null));

        assertEquals("# Canonical", body.text());
        assertTrue(body.inlineMarks().isEmpty());
        assertTrue(body.lineBlocks().isEmpty());
        assertTrue(body.blockEntities().isEmpty());
    }

    @Test
    void fallsBackToMaterializedLegacyMarkdownWhenDocumentIsMissing() {
        UUID itemId = UUID.randomUUID();
        FakeBodyDocumentStore store = new FakeBodyDocumentStore();
        ItemBodyDocumentService service = new ItemBodyDocumentService(store, new ItemBodyMarkdownCodec());

        ItemBody body = service.read(itemId, new ItemBody("Legacy", null, null, null));

        assertEquals("Legacy", body.text());
        assertFalse(store.exists(itemId));
    }

    @Test
    void migrationIsIdempotentAndDoesNotOverwriteExistingDocument() {
        UUID itemId = UUID.randomUUID();
        FakeBodyDocumentStore store = new FakeBodyDocumentStore();
        ItemBodyDocumentService service = new ItemBodyDocumentService(store, new ItemBodyMarkdownCodec());

        assertTrue(service.migrate(itemId, new ItemBody("first", null, null, null)));
        assertFalse(service.migrate(itemId, new ItemBody("second", null, null, null)));
        assertEquals("first", store.read(itemId).orElseThrow());
    }

    private static final class FakeBodyDocumentStore implements BodyDocumentStore {
        private final Map<UUID, String> values = new HashMap<>();

        @Override
        public Optional<String> read(UUID itemId) {
            return Optional.ofNullable(values.get(itemId));
        }

        @Override
        public void write(UUID itemId, String markdown) {
            values.put(itemId, markdown);
        }

        @Override
        public boolean exists(UUID itemId) {
            return values.containsKey(itemId);
        }
    }
}
