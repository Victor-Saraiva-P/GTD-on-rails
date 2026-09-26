package com.gtdonrails.syncserver;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClientReleaseClient {

    private static final String ARCHIVE_SUFFIX = "_linux-x86_64.tar.gz";

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI releaseUri;

    @Autowired
    public ClientReleaseClient(
        ObjectMapper mapper,
        @Value("$" + "{gtd.client.release-url}") String releaseUrl
    ) {
        this(
            mapper,
            HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build(),
            releaseUrl
        );
    }

    public ClientReleaseClient(ObjectMapper mapper, HttpClient http, String releaseUrl) {
        this.mapper = mapper;
        this.http = http;
        this.releaseUri = URI.create(releaseUrl);
    }

    public Release release() {
        JsonNode root = readJson(fetchRelease());
        String version = version(root.path("tag_name").asText());
        return new Release(
            version,
            assetUrl(root, archiveName(version)),
            assetUrl(root, checksumName(version))
        );
    }

    public byte[] download(URI uri) {
        HttpRequest request = request(uri).build();
        try {
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            requireSuccess(response.statusCode(), uri);
            return response.body();
        } catch (IOException exception) {
            throw failure("download release asset", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure("download release asset", exception);
        }
    }

    private String fetchRelease() {
        HttpRequest request = request(releaseUri).build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            requireSuccess(response.statusCode(), releaseUri);
            return response.body();
        } catch (IOException exception) {
            throw failure("fetch latest client release", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure("fetch latest client release", exception);
        }
    }

    private HttpRequest.Builder request(URI uri) {
        return HttpRequest.newBuilder(uri)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "GTD-on-Rails-Client");
    }

    private JsonNode readJson(String body) {
        try {
            return mapper.readTree(body);
        } catch (IOException exception) {
            throw failure("decode latest client release", exception);
        }
    }

    private URI assetUrl(JsonNode root, String expectedName) {
        for (JsonNode asset : root.path("assets")) {
            if (expectedName.equals(asset.path("name").asText())) {
                return URI.create(asset.path("browser_download_url").asText());
            }
        }
        return null;
    }

    private String version(String tagName) {
        String normalized = tagName.startsWith("app-v")
            ? tagName.substring(5)
            : tagName.startsWith("v") ? tagName.substring(1) : tagName;
        ClientVersion.newer(normalized, "0.0.0");
        return normalized;
    }

    static String archiveName(String version) {
        return "GTD.on.Rails.Client_" + version + ARCHIVE_SUFFIX;
    }

    static String checksumName(String version) {
        return archiveName(version) + ".sha256";
    }

    private void requireSuccess(int status, URI uri) {
        if (status >= 200 && status < 300) return;
        throw new IllegalStateException(
            "release request '" + uri + "' failed with HTTP " + status
        );
    }

    private IllegalStateException failure(String action, Exception exception) {
        return new IllegalStateException("Failed to " + action, exception);
    }

    public record Release(String version, URI archiveUrl, URI checksumUrl) {

        public boolean installable() {
            return archiveUrl != null && checksumUrl != null;
        }
    }
}
