package com.gtdonrails.api.maintenance.cutover;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

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
class LegacyDatasetImporterTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private CryptoConverter cryptoConverter;
    private LegacyDatasetImporter importer;

    @BeforeEach
    void setUp() {
        CryptoConverter.applyTokenEncryptionKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        cryptoConverter = new CryptoConverter();
        importer = new LegacyDatasetImporter(jdbcTemplate, cryptoConverter);
    }

    @Test
    void importsAllTablesInOrder() {
        UUID itemId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        UUID iconAssetId = UUID.randomUUID();
        UUID credId = UUID.randomUUID();
        UUID gcalId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-14T23:00:00Z");

        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(new LegacyItemRecord(itemId, "Task 1", "{}", "NEXT_ACTION", now, now, null)),
            List.of(new LegacyContextRecord(contextId, "@home", now, now, null)),
            List.of(new LegacyItemAssetRecord(assetId, itemId, "file.png", "file.png", "image/png", 100, now, now, null)),
            List.of(new LegacyContextIconAssetRecord(iconAssetId, contextId, "icon.png", "icon.png", "image/png", 50, now, now, null)),
            List.of(new LegacyNextActionRecord(itemId, new BigDecimal("1.0"), 30, LocalDate.now(), null, LocalTime.NOON, null, false, null, "NEXT_ACTION", now, now, null)),
            List.of(new LegacyNextActionContextRecord(itemId, contextId)),
            List.of(new LegacyCalendarRecord(itemId, LocalDate.now(), LocalTime.NOON, null, null, null, null, false, "CALENDAR", now, now, null)),
            List.of(new LegacyMaintenanceRunRecord("cleanup", now)),
            List.of(new LegacyGoogleCredentialRecord(credId, "plaintext-token", "refresh-token", "Bearer", now, "scope")),
            List.of(new LegacyGoogleCalendarRecord(gcalId, "primary", "Primary", "#FFF"))
        );

        importer.importDataset(dataset);

        verify(jdbcTemplate).update(contains("INSERT INTO contexts"), eq(contextId), eq("@home"), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO items"), eq(itemId), eq("Task 1"), eq("{}"), eq("NEXT_ACTION"), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO item_assets"), eq(assetId), eq(itemId), eq("file.png"), eq("file.png"), eq("image/png"), eq(100L), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO context_icon_assets"), eq(iconAssetId), eq(contextId), eq("icon.png"), eq("icon.png"), eq("image/png"), eq(50L), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO next_actions"), eq(itemId), eq(new BigDecimal("1.0")), eq(30L), any(), eq(null), any(), eq(null), eq(false), eq(null), eq("NEXT_ACTION"), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO next_action_contexts"), eq(itemId), eq(contextId));
        verify(jdbcTemplate).update(contains("INSERT INTO calendars"), eq(itemId), any(), any(), eq(null), eq(null), eq(null), eq(null), eq(false), eq("CALENDAR"), any(), any(), eq(null));
        verify(jdbcTemplate).update(contains("INSERT INTO maintenance_runs"), eq("cleanup"), any());
        verify(jdbcTemplate).update(contains("INSERT INTO google_credentials"), eq(credId), contains("gtdenc:v1:"), contains("gtdenc:v1:"), eq("Bearer"), any(), eq("scope"));
        verify(jdbcTemplate).update(contains("INSERT INTO google_calendars"), eq(gcalId), eq("primary"), eq("Primary"), eq("#FFF"));
    }

    @Test
    void clearApplicationTablesDeletesInDependencyOrder() {
        importer.clearApplicationTables();

        verify(jdbcTemplate, times(12)).execute((String) any());
    }
}
