package com.gtdonrails.api.sync;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class HttpSyncServerGateway implements SyncServerGateway {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI baseUri;
    private final String authToken;

    @Autowired
    public HttpSyncServerGateway(
        ObjectMapper objectMapper,
        @Value("${gtd.sync.server.base-url:http://127.0.0.1:9473}") String baseUrl,
        @Value("${gtd.sync.server.auth-token:}") String authToken
    ) {
        this(HttpClient.newHttpClient(), objectMapper, URI.create(stripTrailingSlash(baseUrl)), authToken);
    }

    HttpSyncServerGateway(HttpClient httpClient, ObjectMapper objectMapper, URI baseUri) {
        this(httpClient, objectMapper, baseUri, "");
    }

    HttpSyncServerGateway(HttpClient httpClient, ObjectMapper objectMapper, URI baseUri, String authToken) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.baseUri = baseUri;
        this.authToken = authToken == null ? "" : authToken.trim();
    }

    @Override
    public SyncPushResult push(SyncOutboxEvent event, long baseRevision) {
        PushRequest body = new PushRequest(
            event.getOperationId(),
            event.getEntityType(),
            event.getEntityId(),
            baseRevision,
            syncOperation(event.getOperation()),
            event.getOperation() == SyncOutboxOperation.DELETE ? null : event.getPayload(),
            null,
            null,
            "application/json"
        );
        HttpResponse<String> response = sendJson("/v1/mutations", body);
        if (response.statusCode() == 409) throw conflict(response.body());
        requireSuccess(response, "push mutation");
        return read(response.body(), SyncPushResult.class);
    }

    @Override
    public SyncRemoteState state() {
        HttpResponse<String> response = sendGet("/v1/state");
        requireSuccess(response, "read sync server state");
        return read(response.body(), SyncRemoteState.class);
    }

    @Override
    public SyncPullPage changesAfter(long cursor, int limit) {
        String path = "/v1/changes?after=" + cursor + "&limit=" + limit;
        HttpResponse<String> response = sendGet(path);
        requireSuccess(response, "pull change feed");
        return read(response.body(), SyncPullPage.class);
    }


    @Override
    public SyncRemoteObject object(String objectType, String objectId) {
        String path = Path.of("v1", "objects", encodePath(objectType), encodePath(objectId)).toString();
        HttpResponse<String> response = sendGet(path);
        requireSuccess(response, "read canonical object");
        return read(response.body(), SyncRemoteObject.class);
    }

    private HttpResponse<String> sendJson(String path, Object body) {
        try {
            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = authorized(HttpRequest.newBuilder(resolve(path)))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            return send(request);
        } catch (IOException exception) {
            throw protocolFailure("serialize request", exception);
        }
    }

    private HttpResponse<String> sendGet(String path) {
        HttpRequest request = authorized(HttpRequest.newBuilder(resolve(path))).GET().build();
        return send(request);
    }


    private HttpRequest.Builder authorized(HttpRequest.Builder builder) {
        if (!authToken.isBlank()) builder.header("Authorization", "Bearer " + authToken);
        return builder;
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException exception) {
            throw protocolFailure("contact sync server", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw protocolFailure("contact sync server", exception);
        }
    }

    private SyncServerConflictException conflict(String body) {
        ConflictResponse response = read(body, ConflictResponse.class);
        return new SyncServerConflictException(response.message(), response.currentRevision());
    }

    private void requireSuccess(HttpResponse<String> response, String operation) {
        if (response.statusCode() >= 200 && response.statusCode() < 300) return;
        throw new IllegalStateException(
            operation + " failed with HTTP " + response.statusCode()
                + "; expected 2xx response from '" + baseUri + "': " + response.body()
        );
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (IOException exception) {
            throw protocolFailure("decode response as " + type.getSimpleName(), exception);
        }
    }


    private String encodePath(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    private URI resolve(String path) {
        return baseUri.resolve(path);
    }

    private IllegalStateException protocolFailure(String action, Exception exception) {
        return new IllegalStateException(
            "Failed to " + action + " at '" + baseUri + "'; expected compatible GTD sync server",
            exception
        );
    }

    private String syncOperation(SyncOutboxOperation operation) {
        return operation == SyncOutboxOperation.DELETE ? "DELETE" : "UPSERT";
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private record PushRequest(
        java.util.UUID operationId,
        String objectType,
        String objectId,
        long baseRevision,
        String operation,
        String payload,
        String sha256,
        Long byteLength,
        String mediaType
    ) {
    }

    private record ConflictResponse(String message, long currentRevision) {
    }
}
