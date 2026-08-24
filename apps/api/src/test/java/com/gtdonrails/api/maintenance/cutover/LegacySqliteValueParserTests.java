package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class LegacySqliteValueParserTests {

    @Test
    void parsesValidValues() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        UUID uuid = UUID.randomUUID();
        ByteBuffer buffer = ByteBuffer.allocate(16);
        buffer.putLong(uuid.getMostSignificantBits());
        buffer.putLong(uuid.getLeastSignificantBits());

        when(rs.getObject("uuid_str")).thenReturn(uuid.toString());
        when(rs.getObject("uuid_obj")).thenReturn(uuid);
        when(rs.getObject("uuid_bytes")).thenReturn(buffer.array());
        when(rs.getObject("instant_iso")).thenReturn("2026-08-15T12:00:00Z");
        when(rs.getObject("instant_ts")).thenReturn(java.sql.Timestamp.from(Instant.parse("2026-08-15T12:00:00Z")));
        when(rs.getObject("instant_num")).thenReturn(1700000000000L);
        when(rs.getObject("instant_sql")).thenReturn("2026-08-15 12:00:00");
        when(rs.getString("date")).thenReturn("2026-08-15");
        when(rs.getString("time")).thenReturn("14:30:00");
        when(rs.getBigDecimal("dec_obj")).thenReturn(new BigDecimal("2.5"));
        when(rs.getBigDecimal("dec_str")).thenReturn(null);
        when(rs.getString("dec_str")).thenReturn("3.75");

        assertEquals(uuid, LegacySqliteValueParser.readUuid(rs, "uuid_str"));
        assertEquals(uuid, LegacySqliteValueParser.readUuid(rs, "uuid_obj"));
        assertEquals(uuid, LegacySqliteValueParser.readUuid(rs, "uuid_bytes"));
        assertEquals(Instant.parse("2026-08-15T12:00:00Z"), LegacySqliteValueParser.readInstant(rs, "instant_iso"));
        assertEquals(Instant.parse("2026-08-15T12:00:00Z"), LegacySqliteValueParser.readInstant(rs, "instant_ts"));
        assertEquals(Instant.ofEpochMilli(1700000000000L), LegacySqliteValueParser.readInstant(rs, "instant_num"));
        assertEquals(java.sql.Timestamp.valueOf("2026-08-15 12:00:00").toInstant(), LegacySqliteValueParser.readInstant(rs, "instant_sql"));
        assertEquals(LocalDate.of(2026, 8, 15), LegacySqliteValueParser.readLocalDate(rs, "date"));
        assertEquals(LocalTime.of(14, 30, 0), LegacySqliteValueParser.readLocalTime(rs, "time"));
        assertEquals(new BigDecimal("2.5"), LegacySqliteValueParser.readBigDecimal(rs, "dec_obj"));
        assertEquals(new BigDecimal("3.75"), LegacySqliteValueParser.readBigDecimal(rs, "dec_str"));
    }

    @Test
    void parsesEpochMillisAndIsoStringsForDatesAndTimes() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("epoch_num")).thenReturn("1813028400000");
        when(rs.getString("epoch_str")).thenReturn("1813028400000");
        when(rs.getObject("epoch_str")).thenReturn("1813028400000");
        when(rs.getString("iso_instant_date")).thenReturn("2026-08-15T12:00:00Z");
        when(rs.getString("iso_instant_time")).thenReturn("2026-08-15T14:30:00Z");

        LocalDate expectedDate = Instant.ofEpochMilli(1813028400000L).atZone(java.time.ZoneOffset.UTC).toLocalDate();
        LocalTime expectedTime = Instant.ofEpochMilli(1813028400000L).atZone(java.time.ZoneOffset.UTC).toLocalTime();

        assertEquals(expectedDate, LegacySqliteValueParser.readLocalDate(rs, "epoch_num"));
        assertEquals(expectedDate, LegacySqliteValueParser.readLocalDate(rs, "epoch_str"));
        assertEquals(LocalDate.of(2026, 8, 15), LegacySqliteValueParser.readLocalDate(rs, "iso_instant_date"));
        assertEquals(expectedTime, LegacySqliteValueParser.readLocalTime(rs, "epoch_num"));
        assertEquals(expectedTime, LegacySqliteValueParser.readLocalTime(rs, "epoch_str"));
        assertEquals(LocalTime.of(14, 30, 0), LegacySqliteValueParser.readLocalTime(rs, "iso_instant_time"));
        assertEquals(Instant.ofEpochMilli(1813028400000L), LegacySqliteValueParser.readInstant(rs, "epoch_str"));
    }

    @Test
    void returnsNullOnNullOrEmptyInput() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("null_col")).thenReturn(null);
        when(rs.getString("blank_col")).thenReturn("  ");

        assertNull(LegacySqliteValueParser.readUuid(rs, "null_col"));
        assertNull(LegacySqliteValueParser.readInstant(rs, "null_col"));
        assertNull(LegacySqliteValueParser.readLocalDate(rs, "blank_col"));
        assertNull(LegacySqliteValueParser.readLocalTime(rs, "blank_col"));
        assertNull(LegacySqliteValueParser.readBigDecimal(rs, "blank_col"));
    }

    @Test
    void rejectsMalformedUuid() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("bad_str")).thenReturn("not-a-uuid");
        when(rs.getObject("bad_bytes")).thenReturn(new byte[] {1, 2, 3});
        when(rs.getObject("bad_type")).thenReturn(12345);

        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readUuid(rs, "bad_str"));
        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readUuid(rs, "bad_bytes"));
        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readUuid(rs, "bad_type"));
    }

    @Test
    void rejectsMalformedInstant() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("bad_date")).thenReturn("invalid-date-string");
        when(rs.getObject("bad_type")).thenReturn(Boolean.TRUE);

        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readInstant(rs, "bad_date"));
        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readInstant(rs, "bad_type"));
    }

    @Test
    void rejectsMalformedLocalDateAndLocalTime() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("bad_date")).thenReturn("2026/08/15");
        when(rs.getString("bad_time")).thenReturn("99:99:99");

        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readLocalDate(rs, "bad_date"));
        assertThrows(IllegalArgumentException.class, () -> LegacySqliteValueParser.readLocalTime(rs, "bad_time"));
    }

    @Test
    void rejectsMalformedBigDecimal() throws SQLException {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getBigDecimal("bad_dec")).thenReturn(null);
        when(rs.getString("bad_dec")).thenReturn("not-a-number");

        assertThrows(NumberFormatException.class, () -> LegacySqliteValueParser.readBigDecimal(rs, "bad_dec"));
    }
}
