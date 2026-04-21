package com.gtdonrails.api.normalizers;

import org.springframework.stereotype.Component;

@Component
public class ItemTextNormalizer {

    public String normalizeTitle(String value) {
        if (value == null) {
            return null;
        }

        String normalized = normalizeLineEndings(value).trim().replace('\n', ' ').replace('\t', ' ');
        validatePlainText(normalized, "title");
        return normalized;
    }

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
                throw new IllegalArgumentException(fieldName + " contains unsupported control characters");
            }
        }
    }
}
