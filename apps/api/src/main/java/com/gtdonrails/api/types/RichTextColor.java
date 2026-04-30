package com.gtdonrails.api.types;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum RichTextColor {
    GRAY("gray"),
    RED("red"),
    ORANGE("orange"),
    YELLOW("yellow"),
    GREEN("green"),
    BLUE("blue"),
    PURPLE("purple"),
    PINK("pink");

    private final String value;

    RichTextColor(String value) {
        this.value = value;
    }

    @JsonCreator
    public static RichTextColor from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalizedValue = value.trim();
        for (RichTextColor color : values()) {
            if (color.value.equals(normalizedValue)) {
                return color;
            }
        }

        throw new IllegalArgumentException(
            "rich text color '" + value + "' is invalid; expected one of " + allowedValues());
    }

    @JsonValue
    public String value() {
        return value;
    }

    public static String allowedValues() {
        return java.util.Arrays.stream(values())
            .map(RichTextColor::value)
            .toList()
            .toString();
    }
}
