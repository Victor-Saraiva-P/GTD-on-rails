package com.gtdonrails.api.types;

public record Title(String value) {

    public static final int MAX_LENGTH = 200;

    public Title {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("title value '" + value + "' is invalid; expected non-blank text");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                "title value length " + value.length() + " is invalid; expected at most " + MAX_LENGTH + " characters");
        }
    }
}
