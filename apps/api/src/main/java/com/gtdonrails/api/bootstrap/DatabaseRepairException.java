package com.gtdonrails.api.bootstrap;

/** Signals a repair attempt that must leave the existing configuration untouched. */
public class DatabaseRepairException extends RuntimeException {

    /** Creates a repair failure that preserves the existing configuration.
     *
     * <p>Example: {@code new DatabaseRepairException("repair failed", cause)}.</p>
     */
    public DatabaseRepairException(String message, Throwable cause) {
        super(message, cause);
    }

    /** Creates a repair failure without exposing administrative credentials.
     *
     * <p>Example: {@code new DatabaseRepairException("target mismatch")}.</p>
     */
    public DatabaseRepairException(String message) {
        super(message);
    }
}
