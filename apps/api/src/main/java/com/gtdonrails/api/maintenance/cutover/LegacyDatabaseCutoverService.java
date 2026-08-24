package com.gtdonrails.api.maintenance.cutover;

import java.nio.file.Path;

import com.gtdonrails.api.services.DatabaseIdentityService;
import com.gtdonrails.api.services.FileSyncService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class LegacyDatabaseCutoverService {

    private final JdbcTemplate jdbcTemplate;
    private final DatabaseIdentityService databaseIdentityService;
    private final FileSyncService fileSyncService;
    private final LegacySqliteBackupService backupService;
    private final LegacySqliteReader reader;
    private final LegacyDatasetImporter importer;
    private final LegacyCutoverValidator validator;
    private final Path sqlitePath;
    private final Path backupDirectory;

    public LegacyDatabaseCutoverService(
        JdbcTemplate jdbcTemplate, DatabaseIdentityService databaseIdentityService,
        FileSyncService fileSyncService, LegacySqliteBackupService backupService,
        LegacySqliteReader reader, LegacyDatasetImporter importer, LegacyCutoverValidator validator,
        @Value("${gtd.data.root-directory}") String dataRoot,
        @Value("${gtd.backup.directory:${gtd.data.root-directory}/backups}") String backupDirectory
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.databaseIdentityService = databaseIdentityService;
        this.fileSyncService = fileSyncService;
        this.backupService = backupService;
        this.reader = reader;
        this.importer = importer;
        this.validator = validator;
        this.sqlitePath = Path.of(dataRoot).toAbsolutePath().normalize().resolve("gtd-on-rails.db");
        this.backupDirectory = Path.of(backupDirectory).toAbsolutePath().normalize();
    }

    /**
     * Executes the one-time offline transactional cutover from legacy SQLite to PostgreSQL.
     *
     * <p>Example: {@code cutoverService.executeCutover()}.</p>
     */
    public CutoverResult executeCutover() {
        databaseIdentityService.require("PRODUCTION");
        String state = currentCutoverState();
        if ("READY".equals(state)) return CutoverResult.alreadyReady();
        requireAwaitingOrRetryableState(state);
        return runCutoverPipeline();
    }

    private String currentCutoverState() {
        return jdbcTemplate.queryForObject(
            "SELECT state FROM gtd.database_cutover WHERE id = true", String.class);
    }

    private void requireAwaitingOrRetryableState(String state) {
        if ("AWAITING_LEGACY_IMPORT".equals(state) || "FAILED".equals(state)) return;
        throw new IllegalStateException(
            "cutover state value '%s' is invalid; expected AWAITING_LEGACY_IMPORT or FAILED".formatted(state));
    }

    private CutoverResult runCutoverPipeline() {
        syncFiles();
        Path backupFile = backupService.createBackup(sqlitePath, backupDirectory);
        updateCutoverState("IMPORTING");
        try {
            return performImportAndValidation(backupFile);
        } catch (RuntimeException exception) {
            handleCutoverFailure();
            throw exception;
        }
    }

    private void syncFiles() {
        try {
            fileSyncService.syncNow();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("file sync failed during cutover", exception);
        }
    }

    private CutoverResult performImportAndValidation(Path backupFile) {
        importer.clearApplicationTables();
        LegacySqliteDataset dataset = reader.readDataset(sqlitePath);
        importer.importDataset(dataset);
        validator.validate(dataset);
        updateCutoverState("READY");
        return CutoverResult.completed(dataset.totalRecordCount(), backupFile);
    }

    private void handleCutoverFailure() {
        try {
            importer.clearApplicationTables();
        } finally {
            updateCutoverState("FAILED");
        }
    }

    private void updateCutoverState(String newState) {
        jdbcTemplate.update("UPDATE gtd.database_cutover SET state = ? WHERE id = true", newState);
    }
}
