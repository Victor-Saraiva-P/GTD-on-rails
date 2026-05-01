package com.gtdonrails.api;

import java.net.URI;
import java.time.Instant;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

@Component
class ProblemDetailFactory {

    private final String projectName;
    private final String apiBasePath;

    ProblemDetailFactory(
        @Value("${api.project-name:https://gtdonrails.local}") String projectName,
        @Value("${api.base-url:/errors}") String apiBasePath
    ) {
        this.projectName = projectName;
        this.apiBasePath = apiBasePath;
    }

    ProblemDetail create(
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

    ProblemDetail createDefault(
        HttpStatusCode status, @Nullable Object body, WebRequest request) {
        if (status.value() == HttpStatus.NOT_FOUND.value()) {
            String path = extractPath(request);
            String detail =
                String.format("The requested URI '%s' does not exist. Correct it and try again.", path);
            return create(status, "Invalid URI", "/invalid-uri", detail, request);
        }

        String detail =
            body instanceof String string
                ? string
                : HttpStatus.valueOf(status.value()).getReasonPhrase();

        return create(status, "System error", "/system-error", detail, request);
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
