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

    /**
     * Parses a JSON color value into a supported rich-text color.
     *
     * <p>Example: {@code RichTextColor.from("blue")}.</p>
     */
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

    /**
     * Returns the JSON value used for this rich-text color.
     *
     * <p>Example: {@code RichTextColor.BLUE.value()}.</p>
     */
    @JsonValue
    public String value() {
        return value;
    }

    /**
     * Lists supported JSON color values for validation messages.
     *
     * <p>Example: {@code RichTextColor.allowedValues()}.</p>
     */
    public static String allowedValues() {
        return java.util.Arrays.stream(values())
            .map(RichTextColor::value)
            .toList()
            .toString();
    }
}
