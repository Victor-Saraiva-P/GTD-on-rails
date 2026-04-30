package com.gtdonrails.api.json;

public class JsonCodecException extends RuntimeException {

    /**
     * Wraps third-party JSON failures with a project-owned exception type.
     *
     * <p>Example: {@code new JsonCodecException("JSON parsing failed", cause)}.</p>
     */
    public JsonCodecException(String message, Throwable cause) {
        super(message, cause);
    }
}
