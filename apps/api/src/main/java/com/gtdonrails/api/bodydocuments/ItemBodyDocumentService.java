package com.gtdonrails.api.bodydocuments;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.sync.SyncFileOutboxStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ItemBodyDocumentService implements ItemBodySource {

    private final BodyDocumentStore store;
    private final ItemBodyMarkdownCodec codec;
    private final SyncFileOutboxStore fileOutbox;

    @Autowired
    public ItemBodyDocumentService(
        BodyDocumentStore store,
        ItemBodyMarkdownCodec codec,
        SyncFileOutboxStore fileOutbox
    ) {
        this.store = store;
        this.codec = codec;
        this.fileOutbox = fileOutbox;
    }

    ItemBodyDocumentService(BodyDocumentStore store, ItemBodyMarkdownCodec codec) {
        this(store, codec, null);
    }

    @Override
    public ItemBody read(UUID itemId, ItemBody legacyBody) {
        String markdown = store.read(itemId).orElseGet(() -> codec.toMarkdown(legacyBody));
        return markdownBody(markdown);
    }

    /**
     * Persists the requested body as the item's canonical Markdown document.
     *
     * <p>Example: {@code service.write(itemId, request.body())}.</p>
     */
    public ItemBody write(UUID itemId, ItemBody requestedBody) {
        String markdown = codec.toMarkdown(requestedBody);
        store.write(itemId, markdown);
        enqueueBodySync(itemId);
        return markdownBody(markdown);
    }

    /**
     * Materializes a missing body document from the legacy database value.
     *
     * <p>Example: {@code service.migrate(itemId, item.getBody())}.</p>
     */
    public boolean migrate(UUID itemId, ItemBody legacyBody) {
        if (store.exists(itemId)) return false;
        store.write(itemId, codec.toMarkdown(legacyBody));
        enqueueBodySync(itemId);
        return true;
    }


    private void enqueueBodySync(UUID itemId) {
        if (fileOutbox == null) return;
        fileOutbox.enqueueUpsert(
            "body_document",
            itemId.toString(),
            "items/" + itemId + "/body.md",
            "text/markdown"
        );
    }

    private ItemBody markdownBody(String markdown) {
        return new ItemBody(markdown, List.of(), List.of(), List.of());
    }
}
