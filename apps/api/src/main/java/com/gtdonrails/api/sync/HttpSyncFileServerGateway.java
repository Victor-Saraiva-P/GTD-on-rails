package com.gtdonrails.api.sync;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class HttpSyncFileServerGateway implements SyncFileServerGateway {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI endpoint;
    private final String authToken;

    public HttpSyncFileServerGateway(
        ObjectMapper objectMapper,
        @Value("${gtd.sync.server.base-url:http://127.0.0.1:9473}") String baseUrl,
        @Value("${gtd.sync.server.auth-token:}") String authToken
    ) {
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = objectMapper;
        this.endpoint = URI.create(stripTrailingSlash(baseUrl) + "/v1/files");
        this.authToken = authToken == null ? "" : authToken.trim();
    }

    @Override
    public SyncServerGateway.SyncPushResult push(PushRequest requestData) {
        HttpRequest request = requestBuilder(requestData)
            .POST(HttpRequest.BodyPublishers.ofByteArray(
                requestData.content() == null ? new byte[0] : requestData.content()
            ))
            .build();
        HttpResponse<byte[]> response = send(request);
        if (response.statusCode() == 409) throw conflict(response);
        requireSuccess(response, "push file");
        return decode(response.body(), SyncServerGateway.SyncPushResult.class);
    }

    @Override
    public RemoteFileContent read(String objectType, String objectId) {
        HttpRequest request = authorized(HttpRequest.newBuilder(endpoint))
            .header("X-Object-Type", objectType)
            .header("X-Object-Id", objectId)
            .GET()
            .build();
        HttpResponse<byte[]> response = send(request);
        requireSuccess(response, "read file");
        return new RemoteFileContent(
            response.body(),
            header(response, "X-Relative-Path"),
            header(response, "X-Content-Sha256"),
            response.headers().firstValue("Content-Type").orElse("application/octet-stream"),
            Long.parseLong(header(response, "X-Revision"))
        );
    }

    private HttpRequest.Builder requestBuilder(PushRequest requestData) {
        return authorized(HttpRequest.newBuilder(endpoint))
            .header("X-Operation-Id", requestData.operationId().toString())
            .header("X-Object-Type", requestData.objectType())
            .header("X-Object-Id", requestData.objectId())
            .header("X-Base-Revision", Long.toString(requestData.baseRevision()))
            .header("X-Sync-Operation", requestData.operation())
            .header("X-Relative-Path", requestData.relativePath())
            .header(
                "Content-Type",
                requestData.contentType() == null ? "application/octet-stream" : requestData.contentType()
            );
    }


    private HttpRequest.Builder authorized(HttpRequest.Builder builder) {
        if (!authToken.isBlank()) builder.header("Authorization", "Bearer " + authToken);
        return builder;
    }

    private HttpResponse<byte[]> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException exception) {
            throw failure("contact sync file endpoint", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure("contact sync file endpoint", exception);
        }
    }

    private SyncServerConflictException conflict(HttpResponse<byte[]> response) {
        ConflictResponse conflict = decode(response.body(), ConflictResponse.class);
        return new SyncServerConflictException(conflict.message(), conflict.currentRevision());
    }

    private <T> T decode(byte[] body, Class<T> type) {
        try {
            return objectMapper.readValue(body, type);
        } catch (IOException exception) {
            throw failure("decode sync file response", exception);
        }
    }

    private void requireSuccess(HttpResponse<byte[]> response, String action) {
        if (response.statusCode() >= 200 && response.statusCode() < 300) return;
        String body = new String(response.body(), StandardCharsets.UTF_8);
        throw new IllegalStateException(
            action + " failed with HTTP " + response.statusCode() + " at '" + endpoint + "': " + body
        );
    }

    private String header(HttpResponse<byte[]> response, String name) {
        return response.headers().firstValue(name)
            .orElseThrow(() -> new IllegalStateException(
                "sync file response header '" + name + "' missing; expected compatible server"
            ));
    }

    private IllegalStateException failure(String action, Exception exception) {
        return new IllegalStateException(
            "Failed to " + action + " at '" + endpoint + "'; expected compatible GTD sync server",
            exception
        );
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private record ConflictResponse(String message, long currentRevision) {
    }
}
