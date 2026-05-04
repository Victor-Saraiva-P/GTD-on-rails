package com.gtdonrails.api.normalizers;

import org.springframework.stereotype.Component;

@Component
public class ItemTextNormalizer {

    public static final int MAX_BODY_LENGTH = 100_000;

    /**
     * Normalizes title input into printable single-line text.
     *
     * <p>Example: {@code itemTextNormalizer.normalizeTitle(" Capture\tidea ")}.</p>
     */
    public String normalizeTitle(String value) {
        if (value == null) {
            return null;
        }

        String normalized = normalizeLineEndings(value).trim().replace('\n', ' ').replace('\t', ' ');
        validatePlainText(normalized, "title");
        return normalized;
    }

    /**
     * Normalizes body input while preserving printable line breaks.
     *
     * <p>Example: {@code itemTextNormalizer.normalizeBody(" line 1\r\nline 2 ")}.</p>
     */
    public String normalizeBody(String value) {
        return normalizeBodyValue(value);
    }

    /**
     * Normalizes body markdown without requiring a Spring-managed normalizer.
     *
     * <p>Example: {@code ItemTextNormalizer.normalizeBodyValue("# Notes")}.</p>
     */
    public static String normalizeBodyValue(String value) {
        if (value == null) {
            return "";
        }

        String normalized = normalizeLineEndings(value);
        validatePlainText(normalized, "body");
        validateBodyLength(normalized);
        return normalized;
    }

    private static void validateBodyLength(String value) {
        if (value.length() > MAX_BODY_LENGTH) {
            throw new IllegalArgumentException(
                "body length '" + value.length() + "' is invalid; expected at most " + MAX_BODY_LENGTH + " characters");
        }
    }

    private static String normalizeLineEndings(String value) {
        return value.replace("\r\n", "\n").replace('\r', '\n');
    }

    private static void validatePlainText(String value, String fieldName) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isISOControl(character) && character != '\n' && character != '\t') {
                throw new IllegalArgumentException(
                    fieldName + " character U+" + String.format("%04X", (int) character)
                        + " is invalid; expected printable text");
            }
        }
    }
}
