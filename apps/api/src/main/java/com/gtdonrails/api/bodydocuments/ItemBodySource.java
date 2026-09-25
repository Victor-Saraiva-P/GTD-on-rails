package com.gtdonrails.api.bodydocuments;

import java.util.UUID;

import com.gtdonrails.api.types.ItemBody;

@FunctionalInterface
public interface ItemBodySource {

    ItemBody read(UUID itemId, ItemBody legacyBody);

    static ItemBodySource legacy() {
        return (itemId, legacyBody) -> legacyBody == null ? ItemBody.empty() : legacyBody;
    }
}
