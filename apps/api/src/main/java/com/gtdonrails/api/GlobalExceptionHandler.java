package com.gtdonrails.api;

import com.gtdonrails.api.exceptions.context.ContextNotFoundException;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.exceptions.shared.ConflictException;

import jakarta.validation.ConstraintViolation;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;
import lombok.extern.slf4j.Slf4j;
import jakarta.validation.ConstraintViolationException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestCookieException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private final ProblemDetailFactory problemDetailFactory;

    public GlobalExceptionHandler(ProblemDetailFactory problemDetailFactory) {
        this.problemDetailFactory = problemDetailFactory;
    }

    /**
     * Converts missing item errors into a resource-not-found problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleItemNotFoundException(exception, request)}.</p>
     */
    @ExceptionHandler(ItemNotFoundException.class)
    public ResponseEntity<Object> handleItemNotFoundException(
        ItemNotFoundException ex, WebRequest request) {
        return handleResourceNotFoundException(ex, request, "Item not found");
    }

    /**
     * Converts missing context errors into a resource-not-found problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleContextNotFoundException(exception, request)}.</p>
     */
    @ExceptionHandler(ContextNotFoundException.class)
    public ResponseEntity<Object> handleContextNotFoundException(
        ContextNotFoundException ex, WebRequest request) {
        return handleResourceNotFoundException(ex, request, "Context not found");
    }

    private ResponseEntity<Object> handleResourceNotFoundException(
        BusinessException ex, WebRequest request, String logMessage) {
        HttpStatus status = HttpStatus.NOT_FOUND;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status,
                "Resource not found",
                "/resource-not-found",
                ex.getMessage(),
                request);

        log.warn("{}: {}", logMessage, ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts domain conflict errors into a data-conflict problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleConflictException(exception, request)}.</p>
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Object> handleConflictException(
        ConflictException ex, WebRequest request) {
        HttpStatus status = HttpStatus.CONFLICT;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Data conflict", "/data-conflict", ex.getMessage(), request);

        log.warn("Data conflict: {}", ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts domain validation errors into an invalid-operation problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleBusinessException(exception, request)}.</p>
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Object> handleBusinessException(
        BusinessException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid operation", "/invalid-operation", ex.getMessage(), request);

        log.warn("Invalid business operation: {}", ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts method-level validation failures into an invalid-data problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleConstraintViolationException(exception, request)}.</p>
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Object> handleConstraintViolationException(
        ConstraintViolationException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        String detail = ex.getConstraintViolations()
            .stream()
            .map(ConstraintViolation::getMessage)
            .distinct()
            .reduce((first, second) -> first + "\n" + second)
            .orElse(ex.getMessage());
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid data", "/invalid-data", detail, request);

        log.warn("Constraint violation: {}", detail);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts database constraint failures into a data-conflict problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleDataIntegrityViolationException(exception, request)}.</p>
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleDataIntegrityViolationException(
        DataIntegrityViolationException ex, WebRequest request) {
        HttpStatus status = HttpStatus.CONFLICT;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status,
                "Data conflict",
                "/data-conflict",
                "Database data conflict",
                request);

        log.warn("Data integrity violation", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts application state failures into a system-error problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleIllegalStateException(exception, request)}.</p>
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Object> handleIllegalStateException(
        IllegalStateException ex, WebRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "System error", "/system-error", ex.getMessage(), request);

        log.error("Application illegal state", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts unexpected failures into a generic system-error problem response.
     *
     * <p>Example: {@code globalExceptionHandler.handleGenericException(exception, request)}.</p>
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGenericException(Exception ex, WebRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status,
                "System error",
                "/system-error",
                "System error, try again later",
                request);

        log.error("Unexpected system error", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts request-body validation failures into field-level problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleMethodArgumentNotValid(exception, headers, status, request)}.</p>
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
        @NonNull MethodArgumentNotValidException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {

        String detail = validationFailureDetail(ex);
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid data", "/invalid-data", detail, request);

        log.warn("Validation failed: {}", detail);
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    private String validationFailureDetail(MethodArgumentNotValidException ex) {
        StringBuilder detail = new StringBuilder("One or more fields are invalid:\n");
        ex.getBindingResult()
            .getFieldErrors()
            .forEach(fieldError -> appendFieldError(
                detail,
                fieldError.getField(),
                fieldError.getRejectedValue(),
                fieldError.getDefaultMessage()));
        return detail.toString().trim();
    }

    private void appendFieldError(StringBuilder detail, String field, Object rejectedValue, String message) {
        detail.append("- Field '")
            .append(field)
            .append("' value '")
            .append(rejectedValue)
            .append("': ")
            .append(message)
            .append("\n");
    }

    /**
     * Converts invalid URL parameter types into invalid-parameter problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleTypeMismatch(exception, headers, status, request)}.</p>
     */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
        @NonNull TypeMismatchException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {
        String detail =
            String.format(
                "The URL parameter '%s' received the value '%s', which has an invalid type. Correct it and try again.",
                ((MethodArgumentTypeMismatchException) ex).getName(), ex.getValue());

        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid parameter", "/invalid-parameter", detail, request);

        log.warn("Invalid URL parameter: {}", detail);
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    /**
     * Converts malformed request bodies into invalid-data problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleHttpMessageNotReadable(exception, headers, status, request)}.</p>
     */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
        @NonNull HttpMessageNotReadableException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid data", "/invalid-data", "Request body is invalid", request);

        log.warn("Malformed request body", ex);
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    /**
     * Converts unknown API paths into invalid-uri problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleNoResourceFoundException(exception, headers, status, request)}.</p>
     */
    @Override
    protected ResponseEntity<Object> handleNoResourceFoundException(
        @NonNull NoResourceFoundException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {
        String detail =
            String.format(
                "The requested URI '%s' does not exist. Correct it and try again.",
                ex.getResourcePath());

        ProblemDetail problemDetail =
            problemDetailFactory.create(status, "Invalid URI", "/invalid-uri", detail, request);

        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    /**
     * Converts missing header errors into invalid-data problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleMissingRequestHeaderException(exception, request)}.</p>
     */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<Object> handleMissingRequestHeaderException(
        MissingRequestHeaderException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status,
                "Invalid data",
                "/invalid-data",
                "Required header is missing: " + ex.getHeaderName(),
                request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts missing cookie errors into invalid-data problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleMissingRequestCookieException(exception, request)}.</p>
     */
    @ExceptionHandler(MissingRequestCookieException.class)
    public ResponseEntity<Object> handleMissingRequestCookieException(
        MissingRequestCookieException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status,
                "Invalid data",
                "/invalid-data",
                "Required cookie is missing: " + ex.getCookieName(),
                request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Converts argument validation errors into invalid-data problem details.
     *
     * <p>Example: {@code globalExceptionHandler.handleIllegalArgumentException(exception, request)}.</p>
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Object> handleIllegalArgumentException(
        IllegalArgumentException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            problemDetailFactory.create(
                status, "Invalid data", "/invalid-data", ex.getMessage(), request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    /**
     * Ensures every framework-generated error body is returned as Problem Details.
     *
     * <p>Example: {@code globalExceptionHandler.handleExceptionInternal(exception, body, headers, status, request)}.</p>
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
        @NonNull Exception ex,
        @Nullable Object body,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {

        Object responseBody = body;
        if (!(responseBody instanceof ProblemDetail)) {
            responseBody = problemDetailFactory.createDefault(status, body, request);
        }

        return super.handleExceptionInternal(ex, responseBody, headers, status, request);
    }
}
