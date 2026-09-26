package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

@Repository
public class SyncObjectStore {

    private static final int MAX_FEED_LIMIT = 1000;

    private final Path databasePath;

    @Autowired
    public SyncObjectStore(@Value("${gtd.sync-server.database-path}") String databasePath) {
        this(Path.of(databasePath));
    }

    SyncObjectStore(Path databasePath) {
        this.databasePath = databasePath.toAbsolutePath().normalize();
        createParentDirectory();
        initializeSchema();
    }

    /**
     * Applies one optimistic, idempotent mutation to the canonical SQLite store.
     *
     * <p>Example: {@code store.apply(mutation)}.</p>
     */
    public synchronized SyncMutationResult apply(SyncMutation mutation) {
        validateMutation(mutation);
        return inTransaction(connection -> applyInTransaction(connection, mutation));
    }


    /** Returns the result of an already committed operation without mutating state. */
    public synchronized Optional<SyncMutationResult> operationResult(java.util.UUID operationId) {
        if (operationId == null) return Optional.empty();
        return withConnection(connection -> findOperation(connection, operationId.toString()));
    }

    /**
     * Reads one canonical object including tombstones.
     *
     * <p>Example: {@code store.object("items", itemId)}.</p>
     */
    public Optional<SyncObjectSnapshot> object(String objectType, String objectId) {
        String sql = """
            SELECT object_type, object_id, revision, payload, sha256, byte_length, media_type, deleted
            FROM sync_objects WHERE object_type = ? AND object_id = ?
            """;
        return withConnection(connection -> queryObject(connection, sql, objectType, objectId));
    }

    /**
     * Returns ordered changes strictly after the supplied cursor.
     *
     * <p>Example: {@code store.changesAfter(42, 100)}.</p>
     */
    public SyncChangeFeed changesAfter(long cursor, int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, MAX_FEED_LIMIT));
        List<SyncChange> changes = withConnection(connection -> queryChanges(connection, cursor, limit));
        long nextCursor = changes.isEmpty() ? cursor : changes.getLast().cursor();
        return new SyncChangeFeed(nextCursor, changes);
    }

    public Path databasePath() {
        return databasePath;
    }

    /**
     * Returns the stable dataset epoch used to reject clients from a pre-restore history.
     *
     * <p>Example: {@code store.datasetEpoch()}.</p>
     */
    public String datasetEpoch() {
        return withConnection(connection -> scalarString(
            connection,
            "SELECT dataset_epoch FROM sync_meta WHERE id = 1"
        ));
    }

    /**
     * Returns the latest committed change cursor.
     *
     * <p>Example: {@code store.currentCursor()}.</p>
     */
    public long currentCursor() {
        return withConnection(connection -> scalarLong(
            connection,
            "SELECT COALESCE(MAX(cursor), 0) FROM sync_changes"
        ));
    }

    /**
     * Creates a checkpointed copy of the canonical SQLite database.
     *
     * <p>Example: {@code store.snapshotDatabase(snapshotPath)}.</p>
     */
    public synchronized void snapshotDatabase(Path snapshotPath) {
        try {
            Files.createDirectories(snapshotPath.toAbsolutePath().normalize().getParent());
            checkpointWal();
            Files.copy(databasePath, snapshotPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "snapshot path '" + snapshotPath + "' is invalid; expected writable file",
                exception
            );
        }
    }


    /**
     * Replaces the canonical SQLite database with a validated snapshot copy and rotates dataset epoch.
     */
    public synchronized String restoreDatabase(Path snapshotDatabase) {
        Path replacement = databasePath.resolveSibling(databasePath.getFileName() + ".restore");
        try {
            checkpointWal();
            Files.copy(snapshotDatabase, replacement, StandardCopyOption.REPLACE_EXISTING);
            String epoch = UUID.randomUUID().toString();
            prepareRestoredDatabase(replacement, epoch);
            deleteSidecar(databasePath, "-wal");
            deleteSidecar(databasePath, "-shm");
            moveDatabaseIntoPlace(replacement);
            initializeSchema();
            return epoch;
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to restore canonical database from '" + snapshotDatabase + "'",
                exception
            );
        } finally {
            try { Files.deleteIfExists(replacement); } catch (IOException ignored) { }
        }
    }

    private void prepareRestoredDatabase(Path replacement, String epoch) {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + replacement)) {
            connection.setAutoCommit(false);
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys = ON");
                statement.execute("SELECT 1 FROM sync_meta WHERE id = 1");
            }
            try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE sync_meta SET dataset_epoch = ?, created_at = ? WHERE id = 1"
            )) {
                statement.setString(1, epoch);
                statement.setString(2, Instant.now().toString());
                if (statement.executeUpdate() != 1) {
                    throw new IllegalStateException("restored sync database lacks sync_meta row id=1");
                }
            }
            connection.commit();
        } catch (SQLException exception) {
            throw databaseFailure(exception);
        }
    }

    private void moveDatabaseIntoPlace(Path replacement) throws IOException {
        try {
            Files.move(replacement, databasePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(replacement, databasePath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void deleteSidecar(Path database, String suffix) throws IOException {
        Files.deleteIfExists(Path.of(database.toString() + suffix));
    }

    private String scalarString(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            if (!result.next()) throw new SQLException("scalar query returned no row: " + sql);
            return result.getString(1);
        }
    }

    private long scalarLong(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            if (!result.next()) throw new SQLException("scalar query returned no row: " + sql);
            return result.getLong(1);
        }
    }

    private void checkpointWal() {
        withConnection(connection -> {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA wal_checkpoint(TRUNCATE)");
            }
            return null;
        });
    }

    private SyncMutationResult applyInTransaction(Connection connection, SyncMutation mutation) throws SQLException {
        Optional<SyncMutationResult> repeated = findOperation(connection, mutation.operationId().toString());
        if (repeated.isPresent()) return repeated.get();
        long currentRevision = currentRevision(connection, mutation.objectType(), mutation.objectId());
        requireBaseRevision(mutation, currentRevision);
        long revision = currentRevision + 1;
        upsertObject(connection, mutation, revision);
        long cursor = insertChange(connection, mutation, revision);
        recordOperation(connection, mutation.operationId().toString(), revision, cursor);
        enqueueGoogleProjection(connection, mutation);
        return new SyncMutationResult(revision, cursor);
    }

    private Optional<SyncMutationResult> findOperation(Connection connection, String operationId) throws SQLException {
        String sql = "SELECT revision, cursor FROM sync_operations WHERE operation_id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, operationId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next()
                    ? Optional.of(new SyncMutationResult(result.getLong(1), result.getLong(2)))
                    : Optional.empty();
            }
        }
    }

    private long currentRevision(Connection connection, String objectType, String objectId) throws SQLException {
        String sql = "SELECT revision FROM sync_objects WHERE object_type = ? AND object_id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, objectType);
            statement.setString(2, objectId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getLong(1) : 0L;
            }
        }
    }

    private void requireBaseRevision(SyncMutation mutation, long currentRevision) {
        if (mutation.baseRevision() == currentRevision) return;
        throw new SyncConflictException(
            mutation.objectType(),
            mutation.objectId(),
            mutation.baseRevision(),
            currentRevision
        );
    }

    private void upsertObject(Connection connection, SyncMutation mutation, long revision) throws SQLException {
        String sql = """
            INSERT INTO sync_objects
                (object_type, object_id, revision, payload, sha256, byte_length, media_type, deleted, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(object_type, object_id) DO UPDATE SET
                revision = excluded.revision, payload = excluded.payload, sha256 = excluded.sha256,
                byte_length = excluded.byte_length, media_type = excluded.media_type,
                deleted = excluded.deleted, updated_at = excluded.updated_at
            """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bindObjectMutation(statement, mutation, revision);
            statement.executeUpdate();
        }
    }

    private void bindObjectMutation(
        PreparedStatement statement,
        SyncMutation mutation,
        long revision
    ) throws SQLException {
        statement.setString(1, mutation.objectType());
        statement.setString(2, mutation.objectId());
        statement.setLong(3, revision);
        statement.setString(4, isDelete(mutation) ? null : mutation.payload());
        statement.setString(5, isDelete(mutation) ? null : mutation.sha256());
        setNullableLong(statement, 6, isDelete(mutation) ? null : mutation.byteLength());
        statement.setString(7, isDelete(mutation) ? null : mutation.mediaType());
        statement.setInt(8, isDelete(mutation) ? 1 : 0);
        statement.setString(9, Instant.now().toString());
    }

    private long insertChange(Connection connection, SyncMutation mutation, long revision) throws SQLException {
        String sql = """
            INSERT INTO sync_changes
                (object_type, object_id, revision, operation, payload, sha256, byte_length, media_type, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bindChange(statement, mutation, revision);
            statement.executeUpdate();
        }
        return lastInsertRowId(connection);
    }

    private void bindChange(PreparedStatement statement, SyncMutation mutation, long revision) throws SQLException {
        statement.setString(1, mutation.objectType());
        statement.setString(2, mutation.objectId());
        statement.setLong(3, revision);
        statement.setString(4, mutation.operation());
        statement.setString(5, isDelete(mutation) ? null : mutation.payload());
        statement.setString(6, isDelete(mutation) ? null : mutation.sha256());
        setNullableLong(statement, 7, isDelete(mutation) ? null : mutation.byteLength());
        statement.setString(8, isDelete(mutation) ? null : mutation.mediaType());
        statement.setString(9, Instant.now().toString());
    }

    private long lastInsertRowId(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT last_insert_rowid()")) {
            if (!result.next()) throw new SQLException("last_insert_rowid() returned no row");
            return result.getLong(1);
        }
    }

    private void recordOperation(
        Connection connection,
        String operationId,
        long revision,
        long cursor
    ) throws SQLException {
        String sql = "INSERT INTO sync_operations (operation_id, revision, cursor, created_at) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, operationId);
            statement.setLong(2, revision);
            statement.setLong(3, cursor);
            statement.setString(4, Instant.now().toString());
            statement.executeUpdate();
        }
    }

    private void enqueueGoogleProjection(
        Connection connection,
        SyncMutation mutation
    ) throws SQLException {
        if (!isGoogleProjectionType(mutation.objectType())) return;
        String sql = """
            INSERT INTO google_calendar_outbox
                (object_id, status, retry_count, last_error, updated_at)
            VALUES (?, 'PENDING', 0, NULL, ?)
            ON CONFLICT(object_id) DO UPDATE SET
                status = 'PENDING', last_error = NULL, updated_at = excluded.updated_at
            """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, mutation.objectId());
            statement.setString(2, Instant.now().toString());
            statement.executeUpdate();
        }
    }

    private boolean isGoogleProjectionType(String objectType) {
        return "items".equals(objectType)
            || "next_actions".equals(objectType)
            || "calendars".equals(objectType)
            || "projects".equals(objectType);
    }

    private Optional<SyncObjectSnapshot> queryObject(
        Connection connection,
        String sql,
        String objectType,
        String objectId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, objectType);
            statement.setString(2, objectId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Optional.of(readObject(result)) : Optional.empty();
            }
        }
    }

    private SyncObjectSnapshot readObject(ResultSet result) throws SQLException {
        return new SyncObjectSnapshot(
            result.getString("object_type"),
            result.getString("object_id"),
            result.getLong("revision"),
            result.getString("payload"),
            result.getString("sha256"),
            nullableLong(result, "byte_length"),
            result.getString("media_type"),
            result.getInt("deleted") != 0
        );
    }

    private List<SyncChange> queryChanges(Connection connection, long cursor, int limit) throws SQLException {
        String sql = """
            SELECT cursor, object_type, object_id, revision, operation, payload, sha256, byte_length, media_type
            FROM sync_changes WHERE cursor > ? ORDER BY cursor ASC LIMIT ?
            """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, cursor);
            statement.setInt(2, limit);
            return readChanges(statement);
        }
    }

    private List<SyncChange> readChanges(PreparedStatement statement) throws SQLException {
        List<SyncChange> changes = new ArrayList<>();
        try (ResultSet result = statement.executeQuery()) {
            while (result.next()) changes.add(readChange(result));
        }
        return changes;
    }

    private SyncChange readChange(ResultSet result) throws SQLException {
        return new SyncChange(
            result.getLong("cursor"),
            result.getString("object_type"),
            result.getString("object_id"),
            result.getLong("revision"),
            result.getString("operation"),
            result.getString("payload"),
            result.getString("sha256"),
            nullableLong(result, "byte_length"),
            result.getString("media_type")
        );
    }

    private void validateMutation(SyncMutation mutation) {
        if (mutation == null || mutation.operationId() == null) {
            throw new IllegalArgumentException("sync mutation value is invalid; expected non-null operationId");
        }
        requireText("objectType", mutation.objectType());
        requireText("objectId", mutation.objectId());
        if (mutation.baseRevision() < 0) {
            throw new IllegalArgumentException(
                "baseRevision value '" + mutation.baseRevision() + "' is invalid; expected non-negative revision");
        }
        if (!"UPSERT".equals(mutation.operation()) && !"DELETE".equals(mutation.operation())) {
            throw new IllegalArgumentException(
                "operation value '" + mutation.operation() + "' is invalid; expected UPSERT or DELETE");
        }
    }

    private void requireText(String name, String value) {
        if (value != null && !value.isBlank()) return;
        throw new IllegalArgumentException(
            name + " value '" + value + "' is invalid; expected non-blank string");
    }

    private boolean isDelete(SyncMutation mutation) {
        return "DELETE".equals(mutation.operation());
    }

    private void setNullableLong(PreparedStatement statement, int index, Long value) throws SQLException {
        if (value == null) {
            statement.setNull(index, java.sql.Types.BIGINT);
            return;
        }
        statement.setLong(index, value);
    }

    private Long nullableLong(ResultSet result, String column) throws SQLException {
        long value = result.getLong(column);
        return result.wasNull() ? null : value;
    }

    private void createParentDirectory() {
        try {
            Path parent = databasePath.getParent();
            if (parent != null) Files.createDirectories(parent);
        } catch (IOException exception) {
            throw new IllegalStateException(
                "sync database path '" + databasePath + "' is invalid; expected creatable parent directory",
                exception
            );
        }
    }

    private void initializeSchema() {
        withConnection(connection -> {
            for (String statement : schemaStatements()) executeSchemaStatement(connection, statement);
            return null;
        });
    }

    private void executeSchemaStatement(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private List<String> schemaStatements() {
        return List.of(
            syncObjectsSql(),
            syncChangesSql(),
            "CREATE INDEX IF NOT EXISTS idx_sync_changes_cursor ON sync_changes(cursor)",
            syncOperationsSql(),
            syncMetaSql(),
            googleCalendarOutboxSql(),
            googleCalendarMirrorsSql(),
            "INSERT OR IGNORE INTO sync_meta (id, dataset_epoch, created_at) VALUES (1, lower(hex(randomblob(16))), CURRENT_TIMESTAMP)"
        );
    }

    private String syncObjectsSql() {
        return """
            CREATE TABLE IF NOT EXISTS sync_objects (
                object_type TEXT NOT NULL, object_id TEXT NOT NULL, revision INTEGER NOT NULL,
                payload TEXT, sha256 TEXT, byte_length INTEGER, media_type TEXT,
                deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
                PRIMARY KEY (object_type, object_id)
            )
            """;
    }

    private String syncChangesSql() {
        return """
            CREATE TABLE IF NOT EXISTS sync_changes (
                cursor INTEGER PRIMARY KEY AUTOINCREMENT, object_type TEXT NOT NULL,
                object_id TEXT NOT NULL, revision INTEGER NOT NULL, operation TEXT NOT NULL,
                payload TEXT, sha256 TEXT, byte_length INTEGER, media_type TEXT, changed_at TEXT NOT NULL
            )
            """;
    }

    private String syncOperationsSql() {
        return """
            CREATE TABLE IF NOT EXISTS sync_operations (
                operation_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                cursor INTEGER NOT NULL, created_at TEXT NOT NULL
            )
            """;
    }

    private String syncMetaSql() {
        return """
            CREATE TABLE IF NOT EXISTS sync_meta (
                id INTEGER PRIMARY KEY CHECK (id = 1), dataset_epoch TEXT NOT NULL, created_at TEXT NOT NULL
            )
            """;
    }

    private String googleCalendarOutboxSql() {
        return """
            CREATE TABLE IF NOT EXISTS google_calendar_outbox (
                object_id TEXT PRIMARY KEY, status TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, updated_at TEXT NOT NULL
            )
            """;
    }

    private String googleCalendarMirrorsSql() {
        return """
            CREATE TABLE IF NOT EXISTS google_calendar_mirrors (
                name TEXT PRIMARY KEY, google_calendar_id TEXT NOT NULL, color_hex TEXT NOT NULL
            )
            """;
    }

    private <T> T inTransaction(SqlWork<T> work) {
        try (Connection connection = openConnection()) {
            connection.setAutoCommit(false);
            try {
                T result = work.run(connection);
                connection.commit();
                return result;
            } catch (Exception exception) {
                rollback(connection, exception);
                throw rethrow(exception);
            }
        } catch (SQLException exception) {
            throw databaseFailure(exception);
        }
    }

    private <T> T withConnection(SqlWork<T> work) {
        try (Connection connection = openConnection()) {
            return work.run(connection);
        } catch (Exception exception) {
            throw rethrow(exception);
        }
    }

    private Connection openConnection() throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = 30000");
            statement.execute("PRAGMA journal_mode = WAL");
        }
        return connection;
    }

    private void rollback(Connection connection, Exception cause) {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            cause.addSuppressed(rollbackFailure);
        }
    }

    private RuntimeException rethrow(Exception exception) {
        if (exception instanceof RuntimeException runtimeException) return runtimeException;
        if (exception instanceof SQLException sqlException) return databaseFailure(sqlException);
        return new IllegalStateException("sync store operation failed; expected successful SQLite operation", exception);
    }

    private IllegalStateException databaseFailure(SQLException exception) {
        return new IllegalStateException(
            "sync database operation failed for '" + databasePath + "'; expected writable SQLite database",
            exception
        );
    }

    @FunctionalInterface
    private interface SqlWork<T> {
        T run(Connection connection) throws Exception;
    }
}
