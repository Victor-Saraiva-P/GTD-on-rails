package com.gtdonrails.api;

import com.gtdonrails.api.exceptions.inbox.InboxItemNotFoundException;
import com.gtdonrails.api.exceptions.shared.BusinessException;
import com.gtdonrails.api.exceptions.shared.ConflictException;

import java.net.URI;
import java.time.Instant;

import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.TypeMismatchException;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @Value("${api.project-name:https://gtdonrails.local}")
    private String projectName = "https://gtdonrails.local";

    @Value("${api.base-url:/errors}")
    private String apiBasePath = "/errors";

    @ExceptionHandler(InboxItemNotFoundException.class)
    public ResponseEntity<Object> handleInboxItemNotFoundException(
        InboxItemNotFoundException ex, WebRequest request) {
        HttpStatus status = HttpStatus.NOT_FOUND;
        ProblemDetail problemDetail =
            createProblemDetail(
                status,
                "Resource not found",
                "/resource-not-found",
                ex.getMessage(),
                request);

        log.warn("Inbox item not found: {}", ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Object> handleConflictException(
        ConflictException ex, WebRequest request) {
        HttpStatus status = HttpStatus.CONFLICT;
        ProblemDetail problemDetail =
            createProblemDetail(
                status, "Data conflict", "/data-conflict", ex.getMessage(), request);

        log.warn("Data conflict: {}", ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Object> handleBusinessException(
        BusinessException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            createProblemDetail(
                status, "Invalid operation", "/invalid-operation", ex.getMessage(), request);

        log.warn("Invalid business operation: {}", ex.getMessage());
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleDataIntegrityViolationException(
        DataIntegrityViolationException ex, WebRequest request) {
        HttpStatus status = HttpStatus.CONFLICT;
        ProblemDetail problemDetail =
            createProblemDetail(
                status,
                "Data conflict",
                "/data-conflict",
                "Database data conflict",
                request);

        log.warn("Data integrity violation", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Object> handleIllegalStateException(
        IllegalStateException ex, WebRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ProblemDetail problemDetail =
            createProblemDetail(
                status, "System error", "/system-error", ex.getMessage(), request);

        log.error("Application illegal state", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGenericException(Exception ex, WebRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ProblemDetail problemDetail =
            createProblemDetail(
                status,
                "System error",
                "/system-error",
                "System error, try again later",
                request);

        log.error("Unexpected system error", ex);
        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
        @NonNull MethodArgumentNotValidException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {

        StringBuilder detail = new StringBuilder("One or more fields are invalid:\n");
        ex.getBindingResult()
            .getFieldErrors()
            .forEach(
                fieldError ->
                    detail
                        .append("- Field '")
                        .append(fieldError.getField())
                        .append("': ")
                        .append(fieldError.getDefaultMessage())
                        .append("\n"));

        ProblemDetail problemDetail =
            createProblemDetail(
                status, "Invalid data", "/invalid-data", detail.toString().trim(), request);

        log.warn("Validation failed: {}", detail.toString().trim());
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

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
            createProblemDetail(
                status, "Invalid parameter", "/invalid-parameter", detail, request);

        log.warn("Invalid URL parameter: {}", detail);
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
        @NonNull HttpMessageNotReadableException ex,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {
        ProblemDetail problemDetail =
            createProblemDetail(
                status, "Invalid data", "/invalid-data", "Request body is invalid", request);

        log.warn("Malformed request body", ex);
        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

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
            createProblemDetail(status, "Invalid URI", "/invalid-uri", detail, request);

        return handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<Object> handleMissingRequestHeaderException(
        MissingRequestHeaderException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            createProblemDetail(
                status,
                "Invalid data",
                "/invalid-data",
                "Required header is missing: " + ex.getHeaderName(),
                request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(MissingRequestCookieException.class)
    public ResponseEntity<Object> handleMissingRequestCookieException(
        MissingRequestCookieException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            createProblemDetail(
                status,
                "Invalid data",
                "/invalid-data",
                "Required cookie is missing: " + ex.getCookieName(),
                request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Object> handleIllegalArgumentException(
        IllegalArgumentException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problemDetail =
            createProblemDetail(
                status, "Invalid data", "/invalid-data", ex.getMessage(), request);

        return handleExceptionInternal(ex, problemDetail, new HttpHeaders(), status, request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
        @NonNull Exception ex,
        @Nullable Object body,
        @NonNull HttpHeaders headers,
        @NonNull HttpStatusCode status,
        @NonNull WebRequest request) {

        Object responseBody = body;
        if (!(responseBody instanceof ProblemDetail)) {
            responseBody = createDefaultProblemDetail(status, body, request);
        }

        return super.handleExceptionInternal(ex, responseBody, headers, status, request);
    }

    private ProblemDetail createDefaultProblemDetail(
        HttpStatusCode status, @Nullable Object body, WebRequest request) {
        if (status.value() == HttpStatus.NOT_FOUND.value()) {
            String path = extractPath(request);
            String detail =
                String.format("The requested URI '%s' does not exist. Correct it and try again.", path);
            return createProblemDetail(status, "Invalid URI", "/invalid-uri", detail, request);
        }

        String detail =
            body instanceof String string
                ? string
                : HttpStatus.valueOf(status.value()).getReasonPhrase();

        return createProblemDetail(status, "System error", "/system-error", detail, request);
    }

    private ProblemDetail createProblemDetail(
        HttpStatusCode status,
        String title,
        String typePath,
        String detail,
        WebRequest request) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(status, detail);
        String path = extractPath(request);

        problemDetail.setTitle(title);
        problemDetail.setType(URI.create(buildTypeUri(typePath)));
        problemDetail.setInstance(URI.create(path));
        problemDetail.setProperty("path", path);
        problemDetail.setProperty("timestamp", Instant.now().toString());

        return problemDetail;
    }

    private String extractPath(WebRequest request) {
        if (request instanceof ServletWebRequest servletWebRequest) {
            return servletWebRequest.getRequest().getRequestURI();
        }

        String description = request.getDescription(false);
        String prefix = "uri=";
        return description.startsWith(prefix) ? description.substring(prefix.length()) : description;
    }

    private String buildTypeUri(String typePath) {
        String normalizedProjectName = projectName == null ? "" : projectName;
        String normalizedApiBasePath = apiBasePath == null ? "" : apiBasePath;
        return normalizedProjectName + normalizedApiBasePath + typePath;
    }
}
