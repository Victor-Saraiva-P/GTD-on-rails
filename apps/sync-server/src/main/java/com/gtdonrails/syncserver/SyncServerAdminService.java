package com.gtdonrails.syncserver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SyncServerAdminService {

    private static final int MAX_LIST_LIMIT = 500;

    private final SyncObjectStore store;
    private final Path databasePath;
    private final Path filesRoot;
    private final Path backupDirectory;

    public SyncServerAdminService(
        SyncObjectStore store,
        @Value("${gtd.sync-server.database-path}") String databasePath,
        @Value("${gtd.sync-server.files-root}") String filesRoot,
        @Value("${gtd.sync-server.backup-directory}") String backupDirectory
    ) {
        this.store = store;
        this.databasePath = Path.of(databasePath).toAbsolutePath().normalize();
        this.filesRoot = Path.of(filesRoot).toAbsolutePath().normalize();
        this.backupDirectory = Path.of(backupDirectory).toAbsolutePath().normalize();
    }

    public Overview overview() {
        DatabaseStats database = databaseStats();
        FileStats files = fileStats();
        return new Overview(
            store.datasetEpoch(),
            store.currentCursor(),
            database.objectCount(),
            database.deletedCount(),
            database.changeCount(),
            database.operationCount(),
            database.typeCounts(),
            files.fileCount(),
            files.totalBytes(),
            backupCount()
        );
    }

    public List<AdminObject> objects(String type, boolean includeDeleted, int requestedLimit) {
        int limit = boundedLimit(requestedLimit);
        StringBuilder sql = new StringBuilder("""
            select object_type, object_id, revision, payload, sha256, byte_length, media_type, deleted, updated_at
            from sync_objects where 1 = 1
            """);
        List<Object> parameters = new ArrayList<>();
        if (type != null && !type.isBlank()) {
            sql.append(" and object_type = ?");
            parameters.add(type.trim());
        }
        if (!includeDeleted) sql.append(" and deleted = 0");
        sql.append(" order by updated_at desc, object_type, object_id limit ?");
        parameters.add(limit);
        return query(sql.toString(), parameters, this::readObject);
    }

    public List<AdminChange> recentChanges(int requestedLimit) {
        int limit = boundedLimit(requestedLimit);
        String sql = """
            select cursor, object_type, object_id, revision, operation, changed_at
            from sync_changes order by cursor desc limit ?
            """;
        return query(sql, List.of(limit), result -> new AdminChange(
            result.getLong("cursor"),
            result.getString("object_type"),
            result.getString("object_id"),
            result.getLong("revision"),
            result.getString("operation"),
            result.getString("changed_at")
        ));
    }

    public List<AdminFile> files(int requestedLimit) {
        int limit = boundedLimit(requestedLimit);
        if (!Files.isDirectory(filesRoot)) return List.of();
        try (var stream = Files.walk(filesRoot)) {
            return stream
                .filter(Files::isRegularFile)
                .sorted()
                .limit(limit)
                .map(this::adminFile)
                .toList();
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to inspect sync files root '" + filesRoot + "'",
                exception
            );
        }
    }

    public List<BackupInfo> backups() {
        if (!Files.isDirectory(backupDirectory)) return List.of();
        try (var stream = Files.list(backupDirectory)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().endsWith(".zip"))
                .map(this::backupInfo)
                .sorted(Comparator.comparing(BackupInfo::modifiedAt).reversed())
                .toList();
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to inspect backup directory '" + backupDirectory + "'",
                exception
            );
        }
    }

    public void deleteBackup(String fileName) {
        Path backup = resolveBackup(fileName);
        try {
            if (!Files.deleteIfExists(backup)) {
                throw new IllegalArgumentException(
                    "backup file value '" + fileName + "' is invalid; expected existing snapshot"
                );
            }
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to delete backup snapshot '" + backup + "'",
                exception
            );
        }
    }

    private DatabaseStats databaseStats() {
        return withConnection(connection -> {
            long objects = scalarLong(connection, "select count(*) from sync_objects");
            long deleted = scalarLong(connection, "select count(*) from sync_objects where deleted = 1");
            long changes = scalarLong(connection, "select count(*) from sync_changes");
            long operations = scalarLong(connection, "select count(*) from sync_operations");
            return new DatabaseStats(objects, deleted, changes, operations, typeCounts(connection));
        });
    }

    private Map<String, Long> typeCounts(Connection connection) throws SQLException {
        Map<String, Long> counts = new LinkedHashMap<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("""
                 select object_type, count(*) as amount
                 from sync_objects where deleted = 0
                 group by object_type order by object_type
                 """)) {
            while (result.next()) counts.put(result.getString(1), result.getLong(2));
        }
        return counts;
    }

    private FileStats fileStats() {
        if (!Files.isDirectory(filesRoot)) return new FileStats(0, 0);
        try (var stream = Files.walk(filesRoot)) {
            long[] values = new long[2];
            stream.filter(Files::isRegularFile).forEach(path -> {
                values[0]++;
                try {
                    values[1] += Files.size(path);
                } catch (IOException exception) {
                    throw new IllegalStateException(
                        "Failed to inspect sync file '" + path + "'",
                        exception
                    );
                }
            });
            return new FileStats(values[0], values[1]);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect sync files", exception);
        }
    }

    private long backupCount() {
        return backups().size();
    }

    private AdminObject readObject(ResultSet result) throws SQLException {
        return new AdminObject(
            result.getString("object_type"),
            result.getString("object_id"),
            result.getLong("revision"),
            result.getString("payload"),
            result.getString("sha256"),
            nullableLong(result, "byte_length"),
            result.getString("media_type"),
            result.getInt("deleted") != 0,
            result.getString("updated_at")
        );
    }

    private AdminFile adminFile(Path path) {
        try {
            return new AdminFile(
                filesRoot.relativize(path).toString().replace('\\', '/'),
                Files.size(path),
                Files.getLastModifiedTime(path).toInstant().toString()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect sync file '" + path + "'", exception);
        }
    }

    private BackupInfo backupInfo(Path path) {
        try {
            return new BackupInfo(
                path.getFileName().toString(),
                Files.size(path),
                Files.getLastModifiedTime(path).toInstant().toString()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect backup '" + path + "'", exception);
        }
    }

    private Path resolveBackup(String fileName) {
        if (fileName == null || fileName.isBlank()) throw invalidBackup(fileName);
        Path raw = Path.of(fileName);
        if (raw.isAbsolute() || raw.getNameCount() != 1 || !fileName.endsWith(".zip")) {
            throw invalidBackup(fileName);
        }
        Path resolved = backupDirectory.resolve(raw).normalize();
        if (!resolved.startsWith(backupDirectory)) throw invalidBackup(fileName);
        return resolved;
    }

    private IllegalArgumentException invalidBackup(String value) {
        return new IllegalArgumentException(
            "backup file value '" + value + "' is invalid; expected snapshot file name only"
        );
    }

    private int boundedLimit(int value) {
        return Math.max(1, Math.min(value, MAX_LIST_LIMIT));
    }

    private long scalarLong(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            if (!result.next()) return 0;
            return result.getLong(1);
        }
    }

    private Long nullableLong(ResultSet result, String column) throws SQLException {
        long value = result.getLong(column);
        return result.wasNull() ? null : value;
    }

    private <T> List<T> query(String sql, List<Object> parameters, RowReader<T> reader) {
        return withConnection(connection -> {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                for (int index = 0; index < parameters.size(); index++) {
                    statement.setObject(index + 1, parameters.get(index));
                }
                List<T> rows = new ArrayList<>();
                try (ResultSet result = statement.executeQuery()) {
                    while (result.next()) rows.add(reader.read(result));
                }
                return rows;
            }
        });
    }

    private <T> T withConnection(SqlWork<T> work) {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA busy_timeout = 5000");
                statement.execute("PRAGMA query_only = ON");
            }
            return work.run(connection);
        } catch (Exception exception) {
            if (exception instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("Failed to query sync-server administration data", exception);
        }
    }

    private record DatabaseStats(
        long objectCount,
        long deletedCount,
        long changeCount,
        long operationCount,
        Map<String, Long> typeCounts
    ) {
    }

    private record FileStats(long fileCount, long totalBytes) {
    }

    public record Overview(
        String datasetEpoch,
        long cursor,
        long objectCount,
        long deletedCount,
        long changeCount,
        long operationCount,
        Map<String, Long> objectTypes,
        long fileCount,
        long fileBytes,
        long backupCount
    ) {
    }

    public record AdminObject(
        String objectType,
        String objectId,
        long revision,
        String payload,
        String sha256,
        Long byteLength,
        String mediaType,
        boolean deleted,
        String updatedAt
    ) {
    }

    public record AdminChange(
        long cursor,
        String objectType,
        String objectId,
        long revision,
        String operation,
        String changedAt
    ) {
    }

    public record AdminFile(String path, long bytes, String modifiedAt) {
    }

    public record BackupInfo(String fileName, long bytes, String modifiedAt) {
    }

    @FunctionalInterface
    private interface SqlWork<T> {
        T run(Connection connection) throws Exception;
    }

    @FunctionalInterface
    private interface RowReader<T> {
        T read(ResultSet result) throws Exception;
    }
}
