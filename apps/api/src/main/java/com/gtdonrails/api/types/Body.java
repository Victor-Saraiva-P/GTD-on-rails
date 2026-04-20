package com.gtdonrails.api.types;

public record Body(String value) {

    public static final int MAX_LENGTH = 10_000;

    public Body {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("body is required");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("body exceeds max length of " + MAX_LENGTH);
        }
    }
}
