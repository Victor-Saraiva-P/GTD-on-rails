package com.gtdonrails.api.maintenance.cutover;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;

public final class LegacySqliteValueParser {

    private LegacySqliteValueParser() {}

    /**
     * Parses a UUID from a SQLite object value (byte array, UUID instance, or string).
     *
     * <p>Example: {@code LegacySqliteValueParser.readUuid(rs, "id")}.</p>
     */
    public static UUID readUuid(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        if (value instanceof byte[] bytes) return parseUuidBytes(bytes, column);
        if (value instanceof String string) return parseUuidString(string, column);
        throw new IllegalArgumentException(
            "SQLite column '%s' value '%s' is invalid; expected UUID byte array or string".formatted(column, value));
    }

    private static UUID parseUuidBytes(byte[] bytes, String column) {
        if (bytes.length != 16) {
            throw new IllegalArgumentException(
                "SQLite column '%s' byte length %d is invalid; expected 16-byte UUID".formatted(column, bytes.length));
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        return new UUID(buffer.getLong(), buffer.getLong());
    }

    private static UUID parseUuidString(String string, String column) {
        try {
            return UUID.fromString(string);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                "SQLite column '%s' string value '%s' is invalid; expected UUID string".formatted(column, string), exception);
        }
    }

    /**
     * Parses an Instant from a SQLite object value (Timestamp, number, or ISO string).
     *
     * <p>Example: {@code LegacySqliteValueParser.readInstant(rs, "created_at")}.</p>
     */
    public static Instant readInstant(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        if (value == null) return null;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof Number number) return Instant.ofEpochMilli(number.longValue());
        if (value instanceof String string) return parseInstantString(string, column);
        throw new IllegalArgumentException(
            "SQLite column '%s' value '%s' is invalid; expected Instant timestamp or ISO string".formatted(column, value));
    }

    private static Instant parseInstantString(String string, String column) {
        try {
            return Instant.parse(string);
        } catch (DateTimeParseException parseException) {
            return parseFallbackTimestampString(string, column, parseException);
        }
    }

    private static Instant parseFallbackTimestampString(String string, String column, DateTimeParseException original) {
        try {
            return java.sql.Timestamp.valueOf(string).toInstant();
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                "SQLite column '%s' timestamp string '%s' is invalid; expected ISO-8601 instant".formatted(column, string), original);
        }
    }

    /**
     * Parses a LocalDate from a SQLite column.
     *
     * <p>Example: {@code LegacySqliteValueParser.readLocalDate(rs, "scheduled_date")}.</p>
     */
    public static LocalDate readLocalDate(ResultSet rs, String column) throws SQLException {
        String string = rs.getString(column);
        if (string == null || string.isBlank()) return null;
        try {
            return LocalDate.parse(string);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                "SQLite column '%s' date string '%s' is invalid; expected ISO-8601 LocalDate".formatted(column, string), exception);
        }
    }

    /**
     * Parses a LocalTime from a SQLite column.
     *
     * <p>Example: {@code LegacySqliteValueParser.readLocalTime(rs, "scheduled_time")}.</p>
     */
    public static LocalTime readLocalTime(ResultSet rs, String column) throws SQLException {
        String string = rs.getString(column);
        if (string == null || string.isBlank()) return null;
        try {
            return LocalTime.parse(string);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                "SQLite column '%s' time string '%s' is invalid; expected ISO-8601 LocalTime".formatted(column, string), exception);
        }
    }

    /**
     * Parses a BigDecimal from a SQLite column.
     *
     * <p>Example: {@code LegacySqliteValueParser.readBigDecimal(rs, "energy")}.</p>
     */
    public static BigDecimal readBigDecimal(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        if (value == null) {
            String string = rs.getString(column);
            if (string == null || string.isBlank()) return null;
            return new BigDecimal(string);
        }
        return value;
    }
}
