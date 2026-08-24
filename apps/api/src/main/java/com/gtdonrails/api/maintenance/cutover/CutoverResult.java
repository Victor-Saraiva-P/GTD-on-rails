package com.gtdonrails.api.maintenance.cutover;

import java.nio.file.Path;

public record CutoverResult(
    String state,
    int importedRecords,
    Path backupPath
) {
    /**
     * Creates a cutover result indicating the database was already ready.
     *
     * <p>Example: {@code CutoverResult result = CutoverResult.alreadyReady();}.</p>
     */
    public static CutoverResult alreadyReady() {
        return new CutoverResult("READY", 0, null);
    }

    /**
     * Creates a cutover result indicating a completed cutover with imported records and backup path.
     *
     * <p>Example: {@code CutoverResult result = CutoverResult.completed(10, backupPath);}.</p>
     */
    public static CutoverResult completed(int count, Path backupPath) {
        return new CutoverResult("READY", count, backupPath);
    }
}
