package com.gtdonrails.api.services;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncStatusDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarClientGateway {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper;
    private final URI baseUri;
    private final String authToken;

    public GoogleCalendarClientGateway(
        ObjectMapper mapper,
        @Value("$" + "{gtd.sync.server.base-url:http://127.0.0.1:9473}") String baseUrl,
        @Value("$" + "{gtd.sync.server.auth-token:}") String authToken
    ) {
        this.mapper = mapper;
        this.baseUri = URI.create(stripTrailingSlash(baseUrl));
        this.authToken = authToken == null ? "" : authToken.trim();
    }

    public Map<String, Object> status() {
        return readMap(sendGet("/v1/integrations/google-calendar/status"));
    }

    public void saveCredentials(String clientId, String clientSecret) {
        sendJson(
            "/v1/integrations/google-calendar/credentials",
            Map.of("clientId", clientId, "clientSecret", clientSecret)
        );
    }

    public Map<String, Object> authUrl() {
        return readMap(sendPost("/v1/integrations/google-calendar/auth-url"));
    }

    public void reconcile() {
        sendPost("/v1/integrations/google-calendar/reconcile");
    }

    public GoogleCalendarSyncStatusDto syncStatus() {
        HttpResponse<String> response = sendGet("/v1/integrations/google-calendar/sync-status");
        return read(response.body(), GoogleCalendarSyncStatusDto.class);
    }

    private HttpResponse<String> sendJson(String path, Object body) {
        try {
            HttpRequest request = authorized(HttpRequest.newBuilder(resolve(path)))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
            return requireSuccess(send(request), path);
        } catch (IOException exception) {
            throw failure("serialize Google Calendar client request", exception);
        }
    }

    private HttpResponse<String> sendPost(String path) {
        HttpRequest request = authorized(HttpRequest.newBuilder(resolve(path)))
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
        return requireSuccess(send(request), path);
    }

    private HttpResponse<String> sendGet(String path) {
        HttpRequest request = authorized(HttpRequest.newBuilder(resolve(path))).GET().build();
        return requireSuccess(send(request), path);
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException exception) {
            throw failure("contact Google Calendar sync client", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure("contact Google Calendar sync client", exception);
        }
    }

    private HttpResponse<String> requireSuccess(HttpResponse<String> response, String path) {
        if (response.statusCode() >= 200 && response.statusCode() < 300) return response;
        throw new IllegalStateException(
            "Google Calendar sync client request '" + path + "' failed with HTTP "
                + response.statusCode() + ": " + response.body()
        );
    }

    private Map<String, Object> readMap(HttpResponse<String> response) {
        try {
            return mapper.readValue(response.body(), MAP_TYPE);
        } catch (IOException exception) {
            throw failure("decode Google Calendar sync client response", exception);
        }
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (IOException exception) {
            throw failure("decode Google Calendar sync client response", exception);
        }
    }

    private HttpRequest.Builder authorized(HttpRequest.Builder builder) {
        if (!authToken.isBlank()) builder.header("Authorization", "Bearer " + authToken);
        return builder;
    }

    private URI resolve(String path) {
        return URI.create(baseUri + path);
    }

    private IllegalStateException failure(String action, Exception exception) {
        return new IllegalStateException(
            "Failed to " + action + " at '" + baseUri + "'",
            exception
        );
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
