package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.gtdonrails.api.persistence.converters.CryptoConverter;
import com.gtdonrails.api.services.DatabaseIdentityService;
import com.gtdonrails.api.services.FileSyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class LegacyCutoverIntegrationTests {

    @TempDir
    private Path tempDir;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CryptoConverter cryptoConverter;

    @Autowired
    private FileSyncService fileSyncService;

    private Path sqlitePath;
    private Path backupDir;
    private LegacyDatabaseCutoverService cutoverService;
    private LegacyDatasetImporter importer;

    @BeforeEach
    void setUp() {
        sqlitePath = tempDir.resolve("gtd-on-rails.db");
        backupDir = tempDir.resolve("backups");
        LegacySqliteTestFixture.initSchema(sqlitePath);

        LegacySqliteBackupService backupService = new LegacySqliteBackupService(Clock.systemUTC());
        LegacySqliteReader reader = new LegacySqliteReader();
        importer = new LegacyDatasetImporter(jdbcTemplate, cryptoConverter);
        LegacyCutoverValidator validator = new LegacyCutoverValidator(jdbcTemplate, "PRODUCTION");
        DatabaseIdentityService identityService = new DatabaseIdentityService(jdbcTemplate);

        cutoverService = new LegacyDatabaseCutoverService(
            jdbcTemplate, identityService, fileSyncService, backupService,
            reader, importer, validator, tempDir.toString(), backupDir.toString()
        );

        jdbcTemplate.execute("UPDATE database_identity SET environment = 'PRODUCTION' WHERE id = 1");
        jdbcTemplate.execute("UPDATE database_cutover SET state = 'AWAITING_LEGACY_IMPORT' WHERE id = 1");
        importer.clearApplicationTables();
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        jdbcTemplate.execute("UPDATE database_identity SET environment = 'TEST' WHERE id = 1");
        jdbcTemplate.execute("UPDATE database_cutover SET state = 'READY' WHERE id = 1");
        if (importer != null) {
            importer.clearApplicationTables();
        }
    }

    @Test
    void importsLegacySqliteDatabaseEndToEndIntoPostgresql() throws Exception {
        UUID stuffId = UUID.randomUUID();
        UUID nextActionId = UUID.randomUUID();
        UUID calendarId = UUID.randomUUID();
        UUID deletedId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        UUID iconAssetId = UUID.randomUUID();
        UUID credId = UUID.randomUUID();
        UUID gcalId = UUID.randomUUID();

        populateSqliteFixture(stuffId, nextActionId, calendarId, deletedId, contextId, assetId, iconAssetId, credId, gcalId);

        CutoverResult result = cutoverService.executeCutover();

        assertEquals("READY", result.state());
        assertEquals(13, result.importedRecords());
        assertNotNull(result.backupPath());
        assertTrue(Files.exists(result.backupPath()));

        String cutoverState = jdbcTemplate.queryForObject("SELECT state FROM database_cutover WHERE id = 1", String.class);
        assertEquals("READY", cutoverState);

        Integer itemCount = jdbcTemplate.queryForObject("SELECT count(*) FROM items", Integer.class);
        assertEquals(4, itemCount);

        Map<String, Object> stuff = jdbcTemplate.queryForMap("SELECT title, status, deleted_at FROM items WHERE id = ?", stuffId);
        assertEquals("Stuff item", stuff.get("title"));
        assertEquals("STUFF", stuff.get("status"));
        assertNull(stuff.get("deleted_at"));

        Map<String, Object> deleted = jdbcTemplate.queryForMap("SELECT title, deleted_at FROM items WHERE id = ?", deletedId);
        assertEquals("Deleted item", deleted.get("title"));
        assertNotNull(deleted.get("deleted_at"));

        Map<String, Object> nextAction = jdbcTemplate.queryForMap(
            "SELECT energy, estimated_time_minutes, deadline, all_day FROM next_actions WHERE item_id = ?", nextActionId);
        assertEquals(3.0, ((Number) nextAction.get("energy")).doubleValue());
        assertEquals(60L, ((Number) nextAction.get("estimated_time_minutes")).longValue());
        assertEquals(0, ((Number) nextAction.get("all_day")).intValue());

        Integer joinCount = jdbcTemplate.queryForObject("SELECT count(*) FROM next_action_contexts WHERE next_action_id = ? AND context_id = ?", Integer.class, nextActionId, contextId);
        assertEquals(1, joinCount);

        Map<String, Object> calendar = jdbcTemplate.queryForMap("SELECT scheduled_date, all_day FROM calendars WHERE item_id = ?", calendarId);
        assertEquals("2026-08-20", calendar.get("scheduled_date").toString());
        assertEquals(1, ((Number) calendar.get("all_day")).intValue());

        Map<String, Object> cred = jdbcTemplate.queryForMap("SELECT access_token, refresh_token FROM google_credentials WHERE id = ?", credId);
        assertTrue(cred.get("access_token").toString().startsWith("gtdenc:v1:"));
        assertTrue(cred.get("refresh_token").toString().startsWith("gtdenc:v1:"));

        CutoverResult repeatResult = cutoverService.executeCutover();
        assertEquals("READY", repeatResult.state());
        assertEquals(0, repeatResult.importedRecords());
    }

    @Test
    void retriesFromFailedState() throws Exception {
        UUID stuffId = UUID.randomUUID();
        String url = "jdbc:sqlite:" + sqlitePath.toAbsolutePath().normalize();
        try (Connection conn = DriverManager.getConnection(url); Statement stmt = conn.createStatement()) {
            stmt.execute("INSERT INTO items VALUES ('" + stuffId + "', 'Retry stuff', '{\"text\":\"\"}', 'STUFF', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
        }

        jdbcTemplate.execute("UPDATE database_cutover SET state = 'FAILED' WHERE id = 1");

        CutoverResult result = cutoverService.executeCutover();
        assertEquals("READY", result.state());
        assertEquals(1, result.importedRecords());
        assertEquals("READY", jdbcTemplate.queryForObject("SELECT state FROM database_cutover WHERE id = 1", String.class));
    }

    private void populateSqliteFixture(
        UUID stuffId, UUID nextActionId, UUID calendarId, UUID deletedId,
        UUID contextId, UUID assetId, UUID iconAssetId, UUID credId, UUID gcalId
    ) throws Exception {
        String url = "jdbc:sqlite:" + sqlitePath.toAbsolutePath().normalize();
        try (Connection conn = DriverManager.getConnection(url); Statement stmt = conn.createStatement()) {
            stmt.execute("INSERT INTO items VALUES ('" + stuffId + "', 'Stuff item', '{\"text\":\"stuff body\"}', 'STUFF', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO items VALUES ('" + nextActionId + "', 'Action item', '{\"text\":\"action body\"}', 'NEXT_ACTION', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO items VALUES ('" + calendarId + "', 'Calendar item', '{\"text\":\"calendar body\"}', 'CALENDAR', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO items VALUES ('" + deletedId + "', 'Deleted item', '{\"text\":\"deleted\"}', 'STUFF', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', '2026-08-11T10:00:00Z')");
            stmt.execute("INSERT INTO contexts VALUES ('" + contextId + "', '@office', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO item_assets VALUES ('" + assetId + "', '" + nextActionId + "', 'doc.pdf', 'doc.pdf', 'application/pdf', 2048, '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO context_icon_assets VALUES ('" + iconAssetId + "', '" + contextId + "', 'office.svg', 'office.svg', 'image/svg+xml', 128, '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO next_actions VALUES ('" + nextActionId + "', 3.0, 60, '2026-08-15', '2026-08-15', '10:00:00', '11:00:00', 0, '2026-08-25', 'NEXT_ACTION', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO next_action_contexts VALUES ('" + nextActionId + "', '" + contextId + "')");
            stmt.execute("INSERT INTO calendars VALUES ('" + calendarId + "', '2026-08-20', null, '2026-08-20', '2026-08-20', null, null, 1, 'CALENDAR', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z', null)");
            stmt.execute("INSERT INTO maintenance_runs VALUES ('cleanup-job', '2026-08-14T02:00:00Z')");
            stmt.execute("INSERT INTO google_credentials VALUES ('" + credId + "', 'unencrypted-token', 'unencrypted-refresh', 'Bearer', '2026-08-14T23:00:00Z', 'scope-cal')");
            stmt.execute("INSERT INTO google_calendars VALUES ('" + gcalId + "', 'work@company.com', 'Work', '#123456')");
        }
    }
}
