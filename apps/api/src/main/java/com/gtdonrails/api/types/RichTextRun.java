package com.gtdonrails.api.types;

import java.net.URI;
import java.util.List;
import java.util.Set;

public record RichTextRun(
    String text,
    List<String> marks,
    String textColor,
    String backgroundColor,
    String link
) {

    private static final Set<String> ALLOWED_MARKS =
        Set.of("bold", "italic", "underline", "strikethrough", "code");
    private static final Set<String> ALLOWED_COLORS =
        Set.of("gray", "red", "orange", "yellow", "green", "blue", "purple", "pink");

    public RichTextRun {
        requireText(text);
        marks = normalizeMarks(marks);
        requireColor(textColor, "textColor");
        requireColor(backgroundColor, "backgroundColor");
        requireLink(link);
    }

    private static void requireText(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("rich text run text is required; expected non-blank text");
        }
    }

    private static List<String> normalizeMarks(List<String> marks) {
        if (marks == null) {
            return List.of();
        }

        marks.forEach(RichTextRun::requireMark);
        return List.copyOf(marks);
    }

    private static void requireMark(String mark) {
        if (!ALLOWED_MARKS.contains(mark)) {
            throw new IllegalArgumentException(
                "rich text mark '" + mark + "' is invalid; expected one of " + ALLOWED_MARKS);
        }
    }

    private static void requireColor(String color, String fieldName) {
        if (color != null && !ALLOWED_COLORS.contains(color)) {
            throw new IllegalArgumentException(
                "rich text " + fieldName + " '" + color + "' is invalid; expected one of " + ALLOWED_COLORS);
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
