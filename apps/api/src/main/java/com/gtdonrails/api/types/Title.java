package com.gtdonrails.api.types;

public record Title(String value) {

    public static final int MAX_LENGTH = 200;

    public Title {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("title exceeds max length of " + MAX_LENGTH);
        }
    }
}
