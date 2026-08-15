package com.gtdonrails.api.maintenance.cutover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import com.gtdonrails.api.services.DatabaseIdentityService;
import com.gtdonrails.api.services.FileSyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class LegacyCutoverServiceTests {

    @TempDir
    private Path tempDir;

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private DatabaseIdentityService identityService;
    @Mock
    private FileSyncService fileSyncService;
    @Mock
    private LegacySqliteBackupService backupService;
    @Mock
    private LegacySqliteReader reader;
    @Mock
    private LegacyDatasetImporter importer;
    @Mock
    private LegacyCutoverValidator validator;

    private Path sqlitePath;
    private Path backupDir;
    private LegacyDatabaseCutoverService service;

    @BeforeEach
    void setUp() throws IOException {
        sqlitePath = tempDir.resolve("gtd-on-rails.db");
        Files.writeString(sqlitePath, "test-sqlite-data");
        backupDir = tempDir.resolve("backups");
        service = new LegacyDatabaseCutoverService(
            jdbcTemplate, identityService, fileSyncService, backupService,
            reader, importer, validator, tempDir.toString(), backupDir.toString());
    }

    @Test
    void executesFullCutoverSuccessfully() throws Exception {
        when(jdbcTemplate.queryForObject(contains("gtd.database_cutover"), eq(String.class))).thenReturn("AWAITING_LEGACY_IMPORT");
        Path backupFile = backupDir.resolve("gtd-legacy-sqlite-2026.db");
        when(backupService.createBackup(sqlitePath, backupDir)).thenReturn(backupFile);
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(reader.readDataset(sqlitePath)).thenReturn(dataset);

        CutoverResult result = service.executeCutover();

        assertEquals("READY", result.state());
        verify(identityService).require("PRODUCTION");
        verify(fileSyncService).syncNow();
        verify(backupService).createBackup(sqlitePath, backupDir);
        verify(jdbcTemplate).update(contains("UPDATE gtd.database_cutover SET state = ?"), eq("IMPORTING"));
        verify(importer).clearApplicationTables();
        verify(importer).importDataset(dataset);
        verify(validator).validate(dataset);
        verify(jdbcTemplate).update(contains("UPDATE gtd.database_cutover SET state = ?"), eq("READY"));
    }

    @Test
    void repeatedExecutionAgainstReadyIsNoOp() throws Exception {
        when(jdbcTemplate.queryForObject(contains("gtd.database_cutover"), eq(String.class))).thenReturn("READY");

        CutoverResult result = service.executeCutover();

        assertEquals("READY", result.state());
        assertEquals(0, result.importedRecords());
        verify(identityService).require("PRODUCTION");
        verify(fileSyncService, never()).syncNow();
        verify(backupService, never()).createBackup(any(), any());
        verify(importer, never()).importDataset(any());
    }

    @Test
    void retriesSuccessfullyFromFailedState() {
        when(jdbcTemplate.queryForObject(contains("gtd.database_cutover"), eq(String.class))).thenReturn("FAILED");
        Path backupFile = backupDir.resolve("gtd-legacy-sqlite-2026.db");
        when(backupService.createBackup(sqlitePath, backupDir)).thenReturn(backupFile);
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(reader.readDataset(sqlitePath)).thenReturn(dataset);

        CutoverResult result = service.executeCutover();

        assertEquals("READY", result.state());
        verify(importer).clearApplicationTables();
        verify(importer).importDataset(dataset);
        verify(validator).validate(dataset);
        verify(jdbcTemplate).update(contains("UPDATE gtd.database_cutover SET state = ?"), eq("READY"));
    }

    @Test
    void cleansPartialDataSetsFailedAndPreservesSqliteOnFailure() throws IOException {
        when(jdbcTemplate.queryForObject(contains("gtd.database_cutover"), eq(String.class))).thenReturn("AWAITING_LEGACY_IMPORT");
        when(backupService.createBackup(sqlitePath, backupDir)).thenReturn(backupDir.resolve("backup.db"));
        LegacySqliteDataset dataset = new LegacySqliteDataset(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(reader.readDataset(sqlitePath)).thenReturn(dataset);
        doThrow(new IllegalStateException("Validation failed")).when(validator).validate(dataset);

        assertThrows(IllegalStateException.class, () -> service.executeCutover());

        verify(importer, times(2)).clearApplicationTables();
        verify(jdbcTemplate).update(contains("UPDATE gtd.database_cutover SET state = ?"), eq("FAILED"));
        assertTrue(Files.exists(sqlitePath));
        assertEquals("test-sqlite-data", Files.readString(sqlitePath));
    }

    @Test
    void rejectsInvalidCutoverState() {
        when(jdbcTemplate.queryForObject(contains("gtd.database_cutover"), eq(String.class))).thenReturn("IMPORTING");

        assertThrows(IllegalStateException.class, () -> service.executeCutover());
    }
}
