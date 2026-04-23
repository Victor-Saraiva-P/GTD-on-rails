package com.gtdonrails.api.normalizers;

import org.springframework.stereotype.Component;

@Component
public class ContextNameNormalizer {

    public String normalize(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim().replace('\t', ' ');
        validatePlainText(normalized);
        return normalized;
    }

    private void validatePlainText(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isISOControl(character)) {
                throw new IllegalArgumentException("context name contains unsupported control characters");
            }
        }
    }
}
