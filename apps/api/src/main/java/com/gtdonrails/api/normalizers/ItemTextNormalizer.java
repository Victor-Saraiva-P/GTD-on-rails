package com.gtdonrails.api.normalizers;

import org.springframework.stereotype.Component;

@Component
public class ItemTextNormalizer {

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
        if (value == null) {
            return null;
        }

        String normalized = normalizeLineEndings(value).trim();
        validatePlainText(normalized, "body");
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeLineEndings(String value) {
        return value.replace("\r\n", "\n").replace('\r', '\n');
    }

    private void validatePlainText(String value, String fieldName) {
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
