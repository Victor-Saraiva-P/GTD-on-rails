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

    @JsonValue
    public String value() {
        return value;
    }

    public static String allowedValues() {
        return java.util.Arrays.stream(values())
            .map(RichTextMark::value)
            .toList()
            .toString();
    }
}
