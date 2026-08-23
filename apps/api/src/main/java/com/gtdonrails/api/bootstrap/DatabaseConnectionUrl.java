package com.gtdonrails.api.bootstrap;

import java.net.URI;
import java.util.Arrays;

/** Validates and transforms PostgreSQL URLs without retaining administrative credentials. */
final class DatabaseConnectionUrl {

    private static final String JDBC_PREFIX = "jdbc:";

    private DatabaseConnectionUrl() {
    }

    static boolean isSupavisorSessionUrl(String value) {
        try {
            URI parsed = parse(value);
            return "postgresql".equals(parsed.getScheme()) && parsed.getPort() == 5432
                && parsed.getHost() != null && parsed.getHost().endsWith(".pooler.supabase.com")
                && parsed.getUserInfo() == null && hasFullTlsVerification(parsed.getQuery())
                && !hasCredentialQueryParameter(parsed.getQuery());
        } catch (RuntimeException exception) {
            return false;
        }
    }

    static String target(String value) {
        URI parsed = parse(value);
        return parsed.getHost() + ":" + parsed.getPort() + parsed.getPath();
    }

    static String runtimeUrl(String administrativeUrl) {
        URI parsed = parse(administrativeUrl);
        // WHY: tcpKeepAlive prevents cloud middleboxes from silently dropping idle sockets.
        return JDBC_PREFIX + parsed.getScheme() + "://" + parsed.getHost() + ":" + parsed.getPort()
            + parsed.getPath() + "?sslmode=verify-full&currentSchema=gtd&tcpKeepAlive=true";
    }

    static String redacted(String value) {
        if (value == null) return "null";
        try {
            URI parsed = parse(value);
            return JDBC_PREFIX + parsed.getScheme() + "://" + parsed.getHost() + ":" + parsed.getPort()
                + parsed.getPath() + (parsed.getQuery() == null ? "" : "?[redacted]");
        } catch (RuntimeException exception) {
            return "[invalid database URL]";
        }
    }

    private static URI parse(String value) {
        if (value == null || !value.startsWith(JDBC_PREFIX)) throw new IllegalArgumentException("missing JDBC prefix");
        return URI.create(value.substring(JDBC_PREFIX.length()));
    }

    private static boolean hasFullTlsVerification(String query) {
        return query != null && Arrays.stream(query.split("&"))
            .anyMatch(parameter -> parameter.equals("sslmode=verify-full"));
    }

    private static boolean hasCredentialQueryParameter(String query) {
        if (query == null) return false;
        return Arrays.stream(query.split("&")).map(parameter -> parameter.split("=", 2)[0])
            .anyMatch(parameter -> parameter.equalsIgnoreCase("user") || parameter.equalsIgnoreCase("password"));
    }
}
