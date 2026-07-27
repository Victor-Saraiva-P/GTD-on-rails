package com.gtdonrails.api.exceptions.shared;

/** Signals that PostgreSQL cannot safely serve a normal application request. */
public class DatabaseUnavailableException extends RuntimeException {

    /** Creates the unavailable-database response cause.
     *
     * <p>Example: {@code new DatabaseUnavailableException()}.</p>
     */
    public DatabaseUnavailableException() {
        super("PostgreSQL readiness value 'unavailable' is invalid; expected connected database with matching schema, identity, and READY cutover");
    }
}
