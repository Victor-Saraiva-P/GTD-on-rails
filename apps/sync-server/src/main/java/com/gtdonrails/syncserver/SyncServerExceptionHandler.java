package com.gtdonrails.syncserver;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class SyncServerExceptionHandler {

    @ExceptionHandler(SyncConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public SyncConflictResponse conflict(SyncConflictException exception) {
        return new SyncConflictResponse(exception.getMessage(), exception.currentRevision());
    }

    @ExceptionHandler(SyncObjectNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public String notFound(SyncObjectNotFoundException exception) {
        return exception.getMessage();
    }

    public record SyncConflictResponse(String message, long currentRevision) {
    }
}
