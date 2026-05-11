package com.gtdonrails.api.dtos.item;

import com.fasterxml.jackson.annotation.JsonCreator;
import tools.jackson.databind.JsonNode;

public class PatchItemRequestDto {

    private final JsonNode root;

    @JsonCreator
    public PatchItemRequestDto(JsonNode root) {
        this.root = root;
    }

    public boolean hasTitle() {
        return hasField("title");
    }

    public String title() {
        JsonNode node = root.get("title");
        return node == null || node.isNull() ? null : node.asText();
    }

    private boolean hasField(String fieldName) {
        return root != null && root.has(fieldName);
    }
}
