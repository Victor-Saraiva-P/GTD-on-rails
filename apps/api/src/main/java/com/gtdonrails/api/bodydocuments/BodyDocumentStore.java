package com.gtdonrails.api.bodydocuments;

import java.util.Optional;
import java.util.UUID;

/**
 * Persists item body documents independently from relational item metadata.
 *
 * <p>Example: {@code store.write(itemId, "# Notes");}.</p>
 */
public interface BodyDocumentStore {

    Optional<String> read(UUID itemId);

    void write(UUID itemId, String markdown);

    boolean exists(UUID itemId);
}
