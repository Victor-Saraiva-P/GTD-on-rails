package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.persistence.converters.CryptoConverter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class LegacyCutoverValidatorTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private LegacyCutoverValidator validator;

    @BeforeEach
    void setUp() {
        CryptoConverter.applyTokenEncryptionKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        validator = new LegacyCutoverValidator(jdbcTemplate, "PRODUCTION");
    }

    @Test
    void validatesMatchingCountsForeignKeysAndRepresentativeReads() {
        UUID itemId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-14T23:00:00Z");

        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(new LegacyItemRecord(itemId, "Task 1", "{}", "NEXT_ACTION", now, now, null)),
            List.of(new LegacyContextRecord(contextId, "@home", now, now, null)),
            List.of(), List.of(),
            List.of(new LegacyNextActionRecord(itemId, new BigDecimal("1.0"), 30, LocalDate.now(), null, LocalTime.NOON, null, false, null, "NEXT_ACTION", now, now, null)),
            List.of(new LegacyNextActionContextRecord(itemId, contextId)),
            List.of(), List.of(), List.of(), List.of()
        );

        when(jdbcTemplate.queryForObject(contains("gtd.database_identity"), eq(String.class))).thenReturn("PRODUCTION");
        when(jdbcTemplate.queryForObject(contains("FROM gtd.items"), eq(Integer.class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.contexts"), eq(Integer.class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.item_assets"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.context_icon_assets"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.next_actions"), eq(Integer.class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.next_action_contexts"), eq(Integer.class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.calendars"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.maintenance_runs"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.google_credentials"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("FROM gtd.google_calendars"), eq(Integer.class))).thenReturn(0);

        when(jdbcTemplate.queryForObject(contains("LEFT JOIN"), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("SELECT title FROM gtd.items WHERE id = ?"), eq(String.class), eq(itemId))).thenReturn("Task 1");

        assertDoesNotThrow(() -> validator.validate(dataset));
    }

    @Test
    void rejectsWhenDatabaseIdentityMismatch() {
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(jdbcTemplate.queryForObject(contains("gtd.database_identity"), eq(String.class))).thenReturn("STAGING");

        assertThrows(IllegalStateException.class, () -> validator.validate(dataset));
    }

    @Test
    void rejectsWhenRowCountMismatches() {
        UUID itemId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-14T23:00:00Z");
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(new LegacyItemRecord(itemId, "Task 1", "{}", "NEXT_ACTION", now, now, null)),
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(jdbcTemplate.queryForObject(contains("gtd.database_identity"), eq(String.class))).thenReturn("PRODUCTION");
        when(jdbcTemplate.queryForObject(contains("FROM gtd.items"), eq(Integer.class))).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> validator.validate(dataset));
    }

    @Test
    void rejectsWhenOrphanedForeignKeyExists() {
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(jdbcTemplate.queryForObject(contains("gtd.database_identity"), eq(String.class))).thenReturn("PRODUCTION");
        when(jdbcTemplate.queryForObject(contains("FROM gtd."), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("LEFT JOIN"), eq(Integer.class))).thenReturn(1);

        assertThrows(IllegalStateException.class, () -> validator.validate(dataset));
    }
}
