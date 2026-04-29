package com.gtdonrails.api.persistence.bootstrap.services;

import java.nio.file.Path;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SqliteJdbcUrlResolver {

    public Path resolve(String jdbcUrl) {
        if (!StringUtils.hasText(jdbcUrl) || !jdbcUrl.startsWith("jdbc:sqlite:")) {
            throw new IllegalArgumentException("Only jdbc:sqlite URLs are supported");
        }

        String sqlitePath = stripQueryString(stripFilePrefix(stripJdbcPrefix(jdbcUrl)));
        return Path.of(sqlitePath).toAbsolutePath().normalize();
    }

    private String stripJdbcPrefix(String jdbcUrl) {
        return jdbcUrl.substring("jdbc:sqlite:".length());
    }

    private String stripFilePrefix(String sqlitePath) {
        if (sqlitePath.startsWith("file:")) {
            return sqlitePath.substring("file:".length());
        }

        return sqlitePath;
    }

    private String stripQueryString(String sqlitePath) {
        int queryIndex = sqlitePath.indexOf('?');
        if (queryIndex >= 0) {
            return sqlitePath.substring(0, queryIndex);
        }

        return sqlitePath;
    }
}
