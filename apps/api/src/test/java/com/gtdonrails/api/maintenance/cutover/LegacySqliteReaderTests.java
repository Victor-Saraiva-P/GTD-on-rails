package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LegacySqliteReaderTests {

    @TempDir
    private Path tempDir;

    private Path sqlitePath;
    private final LegacySqliteReader reader = new LegacySqliteReader();

    @BeforeEach
    void setUp() {
        sqlitePath = tempDir.resolve("gtd-on-rails.db");
        LegacySqliteTestFixture.initSchema(sqlitePath);
    }

    @Test
    void rejectsMissingOrUnreadableSqlitePath() {
        Path missing = tempDir.resolve("missing.db");
        assertThrows(IllegalArgumentException.class, () -> reader.readDataset(missing));
        assertThrows(IllegalArgumentException.class, () -> reader.readDataset(null));
    }

    @Test
    void readsEmptyDatasetWhenTablesAreEmpty() {
        LegacySqliteDataset dataset = reader.readDataset(sqlitePath);
        assertNotNull(dataset);
        assertEquals(0, dataset.totalRecordCount());
        assertTrue(dataset.items().isEmpty());
        assertTrue(dataset.contexts().isEmpty());
    }

    @Test
    void readsAllEntitiesWithPreservedFields() throws Exception {
        UUID itemId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        UUID iconAssetId = UUID.randomUUID();
        UUID credId = UUID.randomUUID();
        UUID gcalId = UUID.randomUUID();

        insertSampleData(itemId, contextId, assetId, iconAssetId, credId, gcalId);

        LegacySqliteDataset dataset = reader.readDataset(sqlitePath);
        assertEquals(1, dataset.items().size());
        assertEquals(1, dataset.contexts().size());
        assertEquals(1, dataset.itemAssets().size());
        assertEquals(1, dataset.contextIconAssets().size());
        assertEquals(1, dataset.nextActions().size());
        assertEquals(1, dataset.nextActionContexts().size());
        assertEquals(1, dataset.calendars().size());
        assertEquals(1, dataset.maintenanceRuns().size());
        assertEquals(1, dataset.googleCredentials().size());
        assertEquals(1, dataset.googleCalendars().size());

        LegacyItemRecord item = dataset.items().getFirst();
        assertEquals(itemId, item.id());
        assertEquals("Buy groceries", item.title());
        assertEquals("NEXT_ACTION", item.status());
        assertNull(item.deletedAt());

        LegacyContextRecord context = dataset.contexts().getFirst();
        assertEquals(contextId, context.id());
        assertEquals("@errands", context.name());

        LegacyNextActionRecord na = dataset.nextActions().getFirst();
        assertEquals(itemId, na.itemId());
        assertEquals(new BigDecimal("2.5"), na.energy());
        assertEquals(45L, na.estimatedTimeMinutes());
        assertEquals(LocalDate.of(2026, 8, 1), na.dateStart());
        assertEquals(LocalTime.of(9, 0), na.timeStart());
        assertFalse(na.allDay());
        assertEquals(LocalDate.of(2026, 8, 20), na.deadline());

        LegacyCalendarRecord cal = dataset.calendars().getFirst();
        assertEquals(itemId, cal.itemId());
        assertEquals(LocalDate.of(2026, 8, 15), cal.scheduledDate());
        assertEquals(LocalTime.of(14, 30), cal.scheduledTime());
        assertTrue(cal.allDay());

        LegacyGoogleCredentialRecord cred = dataset.googleCredentials().getFirst();
        assertEquals(credId, cred.id());
        assertEquals("ya29.sample-token", cred.accessToken());
        assertEquals("1//sample-refresh", cred.refreshToken());
    }

    private void insertSampleData(UUID itemId, UUID contextId, UUID assetId, UUID iconAssetId, UUID credId, UUID gcalId) throws Exception {
        String url = "jdbc:sqlite:" + sqlitePath.toAbsolutePath().normalize();
        try (Connection conn = DriverManager.getConnection(url);
             Statement stmt = conn.createStatement()) {
            stmt.execute("INSERT INTO items VALUES ('" + itemId + "', 'Buy groceries', '{\"text\":\"milk\"}', 'NEXT_ACTION', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z', null)");
            stmt.execute("INSERT INTO contexts VALUES ('" + contextId + "', '@errands', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO item_assets VALUES ('" + assetId + "', '" + itemId + "', 'receipt.pdf', 'receipt.pdf', 'application/pdf', 1024, '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO context_icon_assets VALUES ('" + iconAssetId + "', '" + contextId + "', 'icon.png', 'icon.png', 'image/png', 512, '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO next_actions VALUES ('" + itemId + "', 2.5, 45, '2026-08-01', '2026-08-01', '09:00:00', '10:00:00', 0, '2026-08-20', 'NEXT_ACTION', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z', null)");
            stmt.execute("INSERT INTO next_action_contexts VALUES ('" + itemId + "', '" + contextId + "')");
            stmt.execute("INSERT INTO calendars VALUES ('" + itemId + "', '2026-08-15', '14:30:00', '2026-08-15', '2026-08-15', null, null, 1, 'CALENDAR', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z', null)");
            stmt.execute("INSERT INTO maintenance_runs VALUES ('daily-cleanup', '2026-08-14T02:00:00Z')");
            stmt.execute("INSERT INTO google_credentials VALUES ('" + credId + "', 'ya29.sample-token', '1//sample-refresh', 'Bearer', '2026-08-14T23:00:00Z', 'https://www.googleapis.com/auth/calendar')");
            stmt.execute("INSERT INTO google_calendars VALUES ('" + gcalId + "', 'primary@gmail.com', 'Primary', '#4285F4')");
        }
    }
}
