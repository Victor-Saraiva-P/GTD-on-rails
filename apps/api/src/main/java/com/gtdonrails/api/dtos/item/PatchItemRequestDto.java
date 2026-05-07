package com.gtdonrails.api.dtos.item;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

    public boolean hasEnergy() {
        return hasField("energy");
    }

    public BigDecimal energy() {
        JsonNode node = root.get("energy");
        return node == null || node.isNull() ? null : new BigDecimal(node.asText());
    }

    public boolean hasEstimatedTime() {
        return hasField("estimatedTime");
    }

    public ItemTimeRequestDto estimatedTime() {
        JsonNode node = root.get("estimatedTime");
        if (node == null || node.isNull()) {
            return null;
        }
        return new ItemTimeRequestDto(node.path("hours").longValue(), node.path("minutes").intValue());
    }

    public boolean hasContextIds() {
        return hasField("contextIds");
    }

    public List<UUID> contextIds() {
        JsonNode node = root.get("contextIds");
        if (node == null || node.isNull()) {
            return null;
        }
        List<UUID> ids = new ArrayList<>();
        for (int index = 0; index < node.size(); index++) {
            ids.add(UUID.fromString(node.get(index).asText()));
        }
        return ids;
    }

    private boolean hasField(String fieldName) {
        return root != null && root.has(fieldName);
    }
}
