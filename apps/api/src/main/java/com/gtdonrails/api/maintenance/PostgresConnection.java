package com.gtdonrails.api.maintenance;

import java.net.URI;
import java.util.List;

/** Holds the limited runtime PostgreSQL connection used by maintenance commands. */
public record PostgresConnection(String jdbcUrl, String username, String password) {

    private static final String JDBC_PREFIX = "jdbc:";

    public PostgresConnection {
        if (jdbcUrl == null || !jdbcUrl.startsWith("jdbc:postgresql://")) {
            throw new IllegalArgumentException("database URL value '%s' is invalid; expected jdbc:postgresql:// URL".formatted(jdbcUrl));
        }
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("database username value '%s' is invalid; expected non-blank username".formatted(username));
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("database password value is invalid; expected non-blank runtime password");
        }
        URI parsed = URI.create(jdbcUrl.substring(JDBC_PREFIX.length()));
        if (!"postgresql".equals(parsed.getScheme()) || parsed.getHost() == null || parsed.getPath() == null) {
            throw new IllegalArgumentException("database URL value '%s' is invalid; expected PostgreSQL host and database path".formatted(jdbcUrl));
        }
    }

    public List<String> dumpArguments(java.nio.file.Path output) {
        return List.of(
            "--format=custom",
            "--no-owner",
            "--no-acl",
            "--no-password",
            "--schema=gtd",
            "--dbname=" + postgresUrl(),
            "--username=" + username,
            "--file=" + output.toString());
    }

    public List<String> restoreArguments(java.nio.file.Path archive) {
        return List.of(
            "--clean",
            "--if-exists",
            "--exit-on-error",
            "--single-transaction",
            "--no-owner",
            "--no-acl",
            "--no-password",
            "--exclude-table=gtd.database_identity",
            "--dbname=" + postgresUrl(),
            "--username=" + username,
            archive.toString());
    }

    public String postgresUrl() {
        String raw = jdbcUrl.substring(JDBC_PREFIX.length());
        int queryIndex = raw.indexOf('?');
        if (queryIndex < 0) return raw;

        String baseUrl = raw.substring(0, queryIndex);
        String queryString = raw.substring(queryIndex + 1);
        String filteredQuery = filterLibpqQuery(queryString);
        return filteredQuery.isEmpty() ? baseUrl : baseUrl + "?" + filteredQuery;
    }

    private static String filterLibpqQuery(String query) {
        // WHY: libpq rejects unrecognized query parameters such as JDBC's currentSchema and tcpKeepAlive.
        return java.util.Arrays.stream(query.split("&"))
            .filter(param -> !param.isBlank() && !param.startsWith("currentSchema=") && !param.startsWith("tcpKeepAlive="))
            .collect(java.util.stream.Collectors.joining("&"));
    }

    public String passfileEntry() {
        URI uri = connectionUri();
        return "%s:%s:%s:%s:%s".formatted(
            uri.getHost(), port(uri), database(uri), escape(username), escape(password));
    }

    private URI connectionUri() {
        return URI.create(postgresUrl());
    }

    private int port(URI uri) {
        return uri.getPort() > 0 ? uri.getPort() : 5432;
    }

    private String database(URI uri) {
        String path = uri.getPath();
        if (path == null || path.length() < 2) {
            throw new IllegalArgumentException("database URL value '%s' is invalid; expected database path".formatted(jdbcUrl));
        }
        return path.substring(1);
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace(":", "\\:");
    }
}
