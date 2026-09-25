package com.gtdonrails.api.exceptions.shared;

/** Signals that the local SQLite database cannot safely serve a normal application request. */
public class DatabaseUnavailableException extends RuntimeException {

    /** Creates the unavailable-database response cause.
     *
     * <p>Example: {@code new DatabaseUnavailableException()}.</p>
     */
    public DatabaseUnavailableException() {
        super("SQLite readiness value 'unavailable' is invalid; expected accessible database with compatible schema and matching identity");
    }
}
