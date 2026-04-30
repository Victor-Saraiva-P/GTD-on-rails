package com.gtdonrails.api.types;

import java.util.List;

public record Body(int version, List<BodyBlock> blocks) {

    public static final int CURRENT_VERSION = 1;

    public Body {
        requireCurrentVersion(version);
        blocks = List.copyOf(requireBlocks(blocks));
    }

    private static void requireCurrentVersion(int version) {
        if (version != CURRENT_VERSION) {
            throw new IllegalArgumentException(
                "body version '" + version + "' is invalid; expected version " + CURRENT_VERSION);
        }
    }

    private static List<BodyBlock> requireBlocks(List<BodyBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) {
            throw new IllegalArgumentException("body blocks are required; expected at least one block");
        }

        return blocks;
    }
}
