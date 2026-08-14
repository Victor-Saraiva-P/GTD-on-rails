package com.gtdonrails.api.maintenance;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;
import java.util.Map;

/** Provides a short-lived owner-only pgpass file for a PostgreSQL client process. */
final class PostgresCommandEnvironment implements AutoCloseable {

    private final Path passfile;

    private PostgresCommandEnvironment(Path passfile) {
        this.passfile = passfile;
    }

    static PostgresCommandEnvironment open(PostgresConnection connection, Path directory) {
        try {
            Path passfile = Files.createTempFile(directory, ".gtd-pgpass-", ".tmp");
            Files.writeString(passfile, connection.passfileEntry() + System.lineSeparator());
            Files.setPosixFilePermissions(passfile, EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
            return new PostgresCommandEnvironment(passfile);
        } catch (IOException exception) {
            throw new IllegalStateException("PostgreSQL password file value '%s' is invalid; expected owner-only temporary file: %s".formatted(directory, exception.getMessage()), exception);
        }
    }

    Map<String, String> environment() {
        return Map.of("PGPASSFILE", passfile.toString());
    }

    @Override
    public void close() {
        try {
            Files.deleteIfExists(passfile);
        } catch (IOException exception) {
            throw new IllegalStateException("PostgreSQL password file value '%s' is invalid; expected removable temporary file: %s".formatted(passfile, exception.getMessage()), exception);
        }
    }
}
