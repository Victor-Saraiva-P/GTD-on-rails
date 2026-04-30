package com.gtdonrails.api.types;

import java.net.URI;
import java.util.List;
import java.util.stream.Stream;

public record RichTextRun(
    String text,
    List<RichTextMark> marks,
    RichTextColor textColor,
    RichTextColor backgroundColor,
    String link
) {

    public RichTextRun {
        text = normalizeText(text);
        link = normalizeOptionalText(link);
        requireText(text);
        marks = normalizeMarks(marks);
        requireLink(link);
    }

    private static String normalizeText(String text) {
        if (text == null) {
            return null;
        }

        String normalizedText = text.replace("\r\n", "\n").replace('\r', '\n');
        requireSupportedTextCharacters(normalizedText);
        return normalizedText;
    }

    private static String normalizeOptionalText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        return text.trim();
    }

    private static void requireText(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("rich text run text is required; expected non-blank text");
        }
    }

    private static List<RichTextMark> normalizeMarks(List<RichTextMark> marks) {
        if (marks == null) {
            return List.of();
        }

        return Stream.of(RichTextMark.values())
            .filter(marks::contains)
            .toList();
    }

    private static void requireSupportedTextCharacters(String text) {
        for (int index = 0; index < text.length(); index++) {
            requireSupportedTextCharacter(text.charAt(index));
        }
    }

    private static void requireSupportedTextCharacter(char character) {
        if (Character.isISOControl(character) && character != '\n' && character != '\t') {
            throw new IllegalArgumentException(
                "rich text run text contains unsupported control character '" + (int) character
                    + "'; expected printable text, newline, or tab");
        }
    }

    private static void requireLink(String link) {
        if (link == null) {
            return;
        }

        requireHttpLink(link);
    }

    private static void requireHttpLink(String link) {
        URI uri = parseUri(link);
        String scheme = uri.getScheme();

        if ((!"http".equals(scheme) && !"https".equals(scheme)) || uri.getHost() == null) {
            throw new IllegalArgumentException("rich text link '" + link + "' is invalid; expected http(s) URL");
        }
    }

    private static URI parseUri(String link) {
        try {
            return URI.create(link);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                "rich text link '" + link + "' is invalid; expected http(s) URL",
                exception);
        }
    }
}
