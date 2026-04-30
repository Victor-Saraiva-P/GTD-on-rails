package com.gtdonrails.api.types;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum RichTextMark {
    BOLD("bold"),
    ITALIC("italic"),
    UNDERLINE("underline"),
    STRIKETHROUGH("strikethrough"),
    CODE("code");

    private final String value;

    RichTextMark(String value) {
        this.value = value;
    }

    /**
     * Parses a JSON mark value into a supported rich-text mark.
     *
     * <p>Example: {@code RichTextMark.from("bold")}.</p>
     */
    @JsonCreator
    public static RichTextMark from(String value) {
        for (RichTextMark mark : values()) {
            if (mark.value.equals(value)) {
                return mark;
            }
        }

        throw new IllegalArgumentException(
            "rich text mark '" + value + "' is invalid; expected one of " + allowedValues());
    }

    /**
     * Returns the JSON value used for this rich-text mark.
     *
     * <p>Example: {@code RichTextMark.BOLD.value()}.</p>
     */
    @JsonValue
    public String value() {
        return value;
    }

    /**
     * Lists supported JSON mark values for validation messages.
     *
     * <p>Example: {@code RichTextMark.allowedValues()}.</p>
     */
    public static String allowedValues() {
        return java.util.Arrays.stream(values())
            .map(RichTextMark::value)
            .toList()
            .toString();
    }
}
